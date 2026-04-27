import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:";

function getKey(): Buffer {
  const raw = process.env.FTP_ENCRYPTION_KEY;
  if (!raw) throw new Error("FTP_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32)
    throw new Error("FTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: enc:<iv_hex>:<tag_hex>:<ciphertext_hex>
  return `${ENC_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value; // plaintext passthrough
  const key = getKey();
  const parts = value.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted value");
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct) + decipher.final("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}
