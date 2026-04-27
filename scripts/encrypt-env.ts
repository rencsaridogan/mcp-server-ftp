#!/usr/bin/env node
/**
 * Utility to encrypt FTP credential env vars for use with mcp-server-ftp.
 *
 * Build first:
 *   npm run build
 *
 * Usage:
 *   FTP_ENCRYPTION_KEY=<64-char-hex> npm run encrypt-env -- <value>
 *
 * Generate a key:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import { encrypt } from "../build/crypto.js";

const value = process.argv[2];
if (!value) {
  console.error("Usage: run `npm run build` first, then: FTP_ENCRYPTION_KEY=<key> npm run encrypt-env -- <plaintext>");
  process.exit(1);
}

try {
  console.log(encrypt(value));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
