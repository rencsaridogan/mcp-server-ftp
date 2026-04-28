import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const KEYCHAIN_SERVICE = "mcp-server-ftp";
const KEYCHAIN_ACCOUNT = "FTP_ENCRYPTION_KEY";

// keytar is a CJS module; ESM named-export interop is incomplete (e.g.
// setPassword only appears on the default export). Always use .default.
async function importKeytar() {
  // Load via createRequire so TypeScript does not need to resolve the
  // optional dependency at compile time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("keytar");
  return mod.default ?? mod;
}

/**
 * Attempts to load FTP_ENCRYPTION_KEY from the OS keychain (macOS Keychain,
 * Windows Credential Manager, or Linux Secret Service via keytar).
 *
 * If the key is already present in process.env.FTP_ENCRYPTION_KEY it is left
 * untouched. If keytar is not installed, or the key has not been stored yet,
 * the function returns silently — the caller can still supply the key through
 * the real process environment (e.g. shell profile).
 */
export async function loadEncryptionKey(): Promise<void> {
  if (process.env.FTP_ENCRYPTION_KEY) return;

  try {
    // keytar is an optional dependency — import dynamically so the server
    // starts normally when it is not installed.
    const keytar = await importKeytar();
    const key = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    if (key) {
      process.env.FTP_ENCRYPTION_KEY = key;
    }
  } catch {
    // keytar unavailable or keychain lookup failed — fall back to env var only
  }
}

/**
 * Stores the given key in the OS keychain so it can be retrieved later by
 * {@link loadEncryptionKey} without being embedded in a config file.
 */
export async function storeEncryptionKey(key: string): Promise<void> {
  const keytar = await importKeytar();
  await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, key);
}
