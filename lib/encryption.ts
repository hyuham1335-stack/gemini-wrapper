import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

// GCM is used with a 16-byte IV per this project's spec. NIST SP 800-38D
// recommends a 12-byte/96-bit IV for GCM (it avoids an extra GHASH pass),
// but Node supports arbitrary IV lengths and 16 bytes remains cryptographically
// sound here — just a deliberate deviation from the "recommended" default.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

type KeyEnvVar = "ENCRYPTION_KEY" | "HASH_KEY";

const keyCache = new Map<KeyEnvVar, Buffer>();

function getKey(envVar: KeyEnvVar): Buffer {
  const cached = keyCache.get(envVar);
  if (cached) return cached;

  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(
      `${envVar} is not set. Run \`npm run db:generate-keys\` to generate it, or set it in .env.local.`
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(raw)) {
    throw new Error(
      `${envVar} must be a 64-character hex string (32 bytes). Run \`npm run db:generate-keys\` to generate a valid key.`
    );
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(`${envVar} must decode to exactly ${KEY_LENGTH} bytes.`);
  }

  keyCache.set(envVar, key);
  return key;
}

/**
 * Encrypts a string with AES-256-GCM. Returns `iv:authTag:ciphertext`, all hex-encoded.
 * A fresh random IV is generated for every call, so encrypting the same value twice
 * produces different output — this is expected, and means the encrypted column can
 * never be used directly in an equality filter (use `hashForLookup` for that).
 */
export function encrypt(plaintext: string): string;
export function encrypt(plaintext: string | null | undefined): string | null;
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;

  const key = getKey("ENCRYPTION_KEY");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts a value produced by `encrypt`. Throws if the payload is malformed,
 * has been tampered with, or was encrypted under a different ENCRYPTION_KEY.
 */
export function decrypt(payload: string): string;
export function decrypt(payload: string | null | undefined): string | null;
export function decrypt(payload: string | null | undefined): string | null {
  if (payload === null || payload === undefined) return null;

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Failed to decrypt value: payload is malformed or key mismatch");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Failed to decrypt value: payload is malformed or key mismatch");
  }

  const key = getKey("ENCRYPTION_KEY");
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, "hex")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new Error("Failed to decrypt value: payload is malformed or key mismatch");
  }
}

/**
 * Deterministic HMAC-SHA256 hash for equality lookups against encrypted columns
 * (e.g. `email_hash = hashForLookup(input)`). Does not normalize input (no
 * lowercasing/trimming) — callers are responsible for normalizing a value the
 * same way before both storing and looking it up.
 */
export function hashForLookup(value: string): string;
export function hashForLookup(value: string | null | undefined): string | null;
export function hashForLookup(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  const key = getKey("HASH_KEY");
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}
