#!/usr/bin/env node
/**
 * Utility to encrypt FTP credential env vars for use with mcp-server-ftp.
 *
 * Usage:
 *   FTP_ENCRYPTION_KEY=<64-char-hex> npx ts-node scripts/encrypt-env.ts <value>
 *
 * Generate a key:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import { encrypt } from "../src/crypto.js";

const value = process.argv[2];
if (!value) {
  console.error("Usage: FTP_ENCRYPTION_KEY=<key> npx ts-node scripts/encrypt-env.ts <plaintext>");
  process.exit(1);
}

try {
  console.log(encrypt(value));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
