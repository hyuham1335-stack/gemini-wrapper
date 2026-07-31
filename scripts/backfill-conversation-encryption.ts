import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../lib/supabase/service";
import { encrypt } from "../lib/encryption";

// Untyped client: database.types.ts won't gain title_encrypted/content_encrypted until it's
// regenerated after this backfill + the follow-up migration land, same reasoning as migrate-encrypt.ts.
type AnyClient = SupabaseClient;

const BATCH_SIZE = 500;

interface CopyConfig {
  table: string;
  primaryKey: string;
  sourceCol: string;
  destCol: string;
}

// One-off migration of plaintext -> encrypted columns (different columns, not the same
// column pre/post encryption), so this doesn't fit migrate-encrypt.ts's reconcile shape.
const COPY_TABLES: CopyConfig[] = [
  { table: "conversations", primaryKey: "id", sourceCol: "title", destCol: "title_encrypted" },
  { table: "messages", primaryKey: "id", sourceCol: "content", destCol: "content_encrypted" },
];

interface Counters {
  scanned: number;
  alreadyDone: number;
  migrated: number;
  failed: number;
}

function newCounters(): Counters {
  return { scanned: 0, alreadyDone: 0, migrated: 0, failed: 0 };
}

async function copyTable(supabase: AnyClient, config: CopyConfig, totals: Counters) {
  let offset = 0;
  for (;;) {
    const { data: rows, error } = await supabase
      .from(config.table)
      .select(`${config.primaryKey}, ${config.sourceCol}, ${config.destCol}`)
      .order(config.primaryKey, { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      throw new Error(`Failed to read ${config.table}: ${error.message}`);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows as unknown as Record<string, unknown>[]) {
      totals.scanned += 1;

      if (row[config.destCol] !== null && row[config.destCol] !== undefined) {
        totals.alreadyDone += 1;
        continue;
      }

      const plaintext = row[config.sourceCol] as string;

      try {
        const { error: updateError } = await supabase
          .from(config.table)
          .update({ [config.destCol]: encrypt(plaintext) })
          .eq(config.primaryKey, row[config.primaryKey]);

        if (updateError) {
          totals.failed += 1;
          console.error(
            `Failed to update ${config.table}.${config.destCol} for ${config.primaryKey}=${row[config.primaryKey]}: ${updateError.message}`
          );
          continue;
        }

        totals.migrated += 1;
      } catch (err) {
        totals.failed += 1;
        console.error(
          `Failed to encrypt ${config.table}.${config.sourceCol} for ${config.primaryKey}=${row[config.primaryKey]}: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
    }

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
}

async function main() {
  const supabase: AnyClient = createServiceClient();
  const totals = newCounters();

  for (const config of COPY_TABLES) {
    await copyTable(supabase, config, totals);
  }

  console.log(JSON.stringify(totals, null, 2));
  process.exitCode = totals.failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
