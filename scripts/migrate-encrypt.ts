import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../lib/supabase/service";
import { decrypt, encrypt, hashForLookup } from "../lib/encryption";

// This script accesses tables generically by name (driven by TABLES below), which the
// strongly-typed Database client can't express — it only accepts table names as literal
// unions. Widen to an untyped client for this file rather than fighting that.
type AnyClient = SupabaseClient;

// iv(32 hex) : authTag(32 hex) : ciphertext(hex, any length incl. 0 for empty string)
const ENCRYPTED_RE = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]*$/i;

const BATCH_SIZE = 500;

interface FieldConfig {
  encryptedCol: string;
  hashCol: string | null;
}

interface TableConfig {
  table: string;
  primaryKey: string;
  fields: FieldConfig[];
}

const TABLES: TableConfig[] = [
  {
    table: "profiles",
    primaryKey: "user_id",
    fields: [
      { encryptedCol: "email_encrypted", hashCol: "email_hash" },
      { encryptedCol: "full_name_encrypted", hashCol: "full_name_hash" },
    ],
  },
];

interface Counters {
  scanned: number;
  alreadyEncrypted: number;
  hashBackfilled: number;
  migrated: number;
  failed: number;
}

function newCounters(): Counters {
  return { scanned: 0, alreadyEncrypted: 0, hashBackfilled: 0, migrated: 0, failed: 0 };
}

async function reconcileTable(supabase: AnyClient, config: TableConfig, totals: Counters) {
  const columns = [config.primaryKey, ...config.fields.flatMap((f) => [f.encryptedCol, f.hashCol])].filter(
    (c): c is string => Boolean(c)
  );

  let offset = 0;
  for (;;) {
    const { data: rows, error } = await supabase
      .from(config.table)
      .select(columns.join(","))
      .order(config.primaryKey, { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      throw new Error(`Failed to read ${config.table}: ${error.message}`);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows as unknown as Record<string, unknown>[]) {
      totals.scanned += 1;

      const updates: Record<string, string | null> = {};
      let rowFailed = false;

      for (const field of config.fields) {
        const currentValue = row[field.encryptedCol] as string | null;
        if (currentValue === null || currentValue === undefined) continue;

        const isEncrypted = ENCRYPTED_RE.test(currentValue);
        const currentHash = field.hashCol ? (row[field.hashCol] as string | null) : null;

        try {
          if (isEncrypted) {
            if (field.hashCol && !currentHash) {
              const plaintext = decrypt(currentValue);
              updates[field.hashCol] = hashForLookup(plaintext);
            }
          } else {
            updates[field.encryptedCol] = encrypt(currentValue);
            if (field.hashCol) {
              updates[field.hashCol] = hashForLookup(currentValue);
            }
          }
        } catch (err) {
          rowFailed = true;
          console.error(
            `Failed to process ${config.table}.${field.encryptedCol} for ${config.primaryKey}=${row[config.primaryKey]}: ${
              err instanceof Error ? err.message : err
            }`
          );
        }
      }

      if (rowFailed) {
        totals.failed += 1;
        continue;
      }

      if (Object.keys(updates).length === 0) {
        totals.alreadyEncrypted += 1;
        continue;
      }

      const isFullReEncrypt = Object.keys(updates).some((col) =>
        config.fields.some((f) => f.encryptedCol === col)
      );

      const { error: updateError } = await supabase
        .from(config.table)
        .update(updates)
        .eq(config.primaryKey, row[config.primaryKey]);

      if (updateError) {
        totals.failed += 1;
        console.error(
          `Failed to update ${config.table} ${config.primaryKey}=${row[config.primaryKey]}: ${updateError.message}`
        );
        continue;
      }

      if (isFullReEncrypt) {
        totals.migrated += 1;
      } else {
        totals.hashBackfilled += 1;
      }
    }

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
}

async function main() {
  const supabase: AnyClient = createServiceClient();
  const totals = newCounters();

  for (const config of TABLES) {
    await reconcileTable(supabase, config, totals);
  }

  console.log(JSON.stringify(totals, null, 2));
  process.exitCode = totals.failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
