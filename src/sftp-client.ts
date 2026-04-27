import Ssh2SftpClient from "ssh2-sftp-client";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface SftpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  passphrase: string;     // decrypted passphrase for SSH private key; ignored when no key is found
  privateKeyPath: string; // path to SSH private key
}

function resolvePrivateKey(keyPath: string): Buffer | undefined {
  const expanded =
    keyPath === "~"
      ? os.homedir()
      : keyPath.startsWith("~/")
        ? path.join(os.homedir(), keyPath.slice(2))
        : keyPath;
  if (fs.existsSync(expanded)) return fs.readFileSync(expanded);
  return undefined;
}

const DEFAULT_KEY_PATHS = ["~/.ssh/id_ed25519", "~/.ssh/id_rsa", "~/.ssh/id_ecdsa"];

async function safeDisconnect(client: Ssh2SftpClient): Promise<void> {
  try { await client.end(); } catch { /* ignore disconnect errors */ }
}

type FileEntry = { name: string; type: string; size: number; modifiedDate: string };

export class SftpClient {
  private config: SftpConfig;
  private tempDir: string;

  constructor(config: SftpConfig) {
    this.config = config;
    this.tempDir = path.join(os.tmpdir(), "mcp-ftp-temp");
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
  }

  private buildClientOptions() {
    // Resolve key from explicit path first, then fall back to ~/.ssh defaults
    let privateKey: Buffer | undefined;
    if (this.config.privateKeyPath) {
      privateKey = resolvePrivateKey(this.config.privateKeyPath);
      if (!privateKey) {
        throw new Error(
          `FTP_PRIVATE_KEY_PATH is set to "${this.config.privateKeyPath}" but no key could be read from that path.`
        );
      }
    } else {
      for (const p of DEFAULT_KEY_PATHS) {
        privateKey = resolvePrivateKey(p);
        if (privateKey) break;
      }
    }

    const clientOptions: Record<string, unknown> = {
      host: this.config.host,
      port: this.config.port,
      username: this.config.user,
    };

    if (privateKey) {
      clientOptions.privateKey = privateKey;
      if (this.config.passphrase) clientOptions.passphrase = this.config.passphrase;
    } else {
      clientOptions.password = this.config.password;
    }

    return clientOptions;
  }

  async listDirectory(remotePath: string): Promise<FileEntry[]> {
    const client = new Ssh2SftpClient();
    try {
      await client.connect(this.buildClientOptions());
      const list = await client.list(remotePath);
      return list.map((item) => ({
        name: item.name,
        type: item.type === "d" ? "directory" : "file",
        size: item.size,
        modifiedDate: new Date(item.modifyTime).toISOString(),
      }));
    } finally {
      await safeDisconnect(client);
    }
  }

  async downloadFile(remotePath: string): Promise<{ filePath: string; content: string }> {
    const client = new Ssh2SftpClient();
    const tempFilePath = path.join(this.tempDir, `download-${Date.now()}-${path.basename(remotePath)}`);
    try {
      await client.connect(this.buildClientOptions());
      await client.fastGet(remotePath, tempFilePath);
      const content = fs.readFileSync(tempFilePath, "utf8");
      return { filePath: tempFilePath, content };
    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      await safeDisconnect(client);
    }
  }

  async uploadFile(remotePath: string, content: string): Promise<boolean> {
    const client = new Ssh2SftpClient();
    const tempFilePath = path.join(this.tempDir, `upload-${Date.now()}-${path.basename(remotePath)}`);
    try {
      fs.writeFileSync(tempFilePath, content);
      await client.connect(this.buildClientOptions());
      await client.fastPut(tempFilePath, remotePath);
      return true;
    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      await safeDisconnect(client);
    }
  }

  async createDirectory(remotePath: string): Promise<boolean> {
    const client = new Ssh2SftpClient();
    try {
      await client.connect(this.buildClientOptions());
      await client.mkdir(remotePath, true);
      return true;
    } finally {
      await safeDisconnect(client);
    }
  }

  async deleteFile(remotePath: string): Promise<boolean> {
    const client = new Ssh2SftpClient();
    try {
      await client.connect(this.buildClientOptions());
      await client.delete(remotePath);
      return true;
    } finally {
      await safeDisconnect(client);
    }
  }

  async deleteDirectory(remotePath: string): Promise<boolean> {
    const client = new Ssh2SftpClient();
    try {
      await client.connect(this.buildClientOptions());
      await client.rmdir(remotePath, true);
      return true;
    } finally {
      await safeDisconnect(client);
    }
  }
}
