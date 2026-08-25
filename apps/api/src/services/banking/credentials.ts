import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGO = "aes-256-gcm";

function bankingEncryptionKey(): Buffer {
  const raw =
    process.env.BANKING_ENCRYPTION_KEY?.trim() ||
    process.env.FISCAL_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 16) {
    throw new Error(
      "BANKING_ENCRYPTION_KEY ou FISCAL_ENCRYPTION_KEY ausente/curta (mín. 16 chars)",
    );
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptBankingSecret(plain: string): string {
  const key = bankingEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptBankingSecret(payload: string): string {
  const key = bankingEncryptionKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

/** Lê secrets de variáveis de ambiente com prefixo (ex.: BANKING_SANTANDER_ORG1_). */
export function readSecretsFromEnvPrefix(
  prefix: string | null | undefined,
): Record<string, string> {
  if (!prefix?.trim()) return {};
  const p = prefix.trim().endsWith("_") ? prefix.trim() : `${prefix.trim()}_`;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(p) || value == null || value === "") continue;
    const short = key.slice(p.length);
    if (short) out[short] = value;
  }
  return out;
}

export function parseEncryptedCredentialsJson(
  encrypted: string | null | undefined,
): Record<string, string> {
  if (!encrypted?.trim()) return {};
  try {
    const json = decryptBankingSecret(encrypted);
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.length > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function encryptCredentialsJson(
  secrets: Record<string, string>,
): string {
  return encryptBankingSecret(JSON.stringify(secrets));
}

export function safeEqualToken(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function hmacSha256Hex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function asMetadataRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
