import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ENV_PATH = join(process.cwd(), ".env.local");
const KEYS_TO_GENERATE = ["ENCRYPTION_KEY", "HASH_KEY"] as const;

function hasNonEmptyValue(envContent: string, key: string): boolean {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match !== null && match[1].trim().length > 0;
}

function main() {
  const envContent = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const linesToAppend: string[] = [];

  for (const key of KEYS_TO_GENERATE) {
    if (hasNonEmptyValue(envContent, key)) {
      console.warn(
        `${key} already set, skipping — existing encrypted data depends on this key, do not regenerate.`
      );
      continue;
    }

    const value = randomBytes(32).toString("hex");
    linesToAppend.push(`${key}=${value}`);
    console.log(`${key}=${value}`);
  }

  if (linesToAppend.length === 0) {
    console.log("Nothing to do — all keys already set.");
    return;
  }

  const separator = envContent.length > 0 && !envContent.endsWith("\n") ? "\n" : "";
  const updated = envContent + separator + linesToAppend.join("\n") + "\n";
  writeFileSync(ENV_PATH, updated, "utf8");
  console.log(`Wrote ${linesToAppend.length} key(s) to ${ENV_PATH}`);
}

main();
