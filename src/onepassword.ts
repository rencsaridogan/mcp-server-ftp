import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Returns true when the value is a 1Password secret reference
 * (e.g. "op://Private/ssh key/private key").
 */
export function isOnePasswordRef(value: string): boolean {
  return value.startsWith("op://");
}

/**
 * Resolves a 1Password secret reference via the 1Password CLI (`op read`).
 *
 * Requires the `op` CLI to be installed and authenticated — either through
 * the 1Password desktop app integration (may trigger a biometric prompt) or
 * a service account token in OP_SERVICE_ACCOUNT_TOKEN.
 */
export async function readOnePasswordSecret(ref: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("op", ["read", ref]);
    return stdout;
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stderr?: string };
    if (err.code === "ENOENT") {
      throw new Error(
        `Cannot resolve "${ref}": the 1Password CLI (op) is not installed or not on PATH. ` +
          `Install it from https://developer.1password.com/docs/cli/ or use a file path instead.`
      );
    }
    const detail = err.stderr?.trim() || err.message;
    throw new Error(`Failed to read "${ref}" from 1Password CLI: ${detail}`);
  }
}
