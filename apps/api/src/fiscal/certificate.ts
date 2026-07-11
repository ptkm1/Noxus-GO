import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type CertificateInfo = {
  cnpj: string | null;
  expiresAt: Date | null;
  subject: string | null;
};

/** Extrai metadados do PFX via OpenSSL (disponível na maioria dos ambientes). */
export function parsePfxMetadata(pfx: Buffer, password: string): CertificateInfo {
  const dir = mkdtempSync(join(tmpdir(), "pedidos-pfx-"));
  const pfxPath = join(dir, "cert.pfx");
  const pemPath = join(dir, "cert.pem");
  try {
    writeFileSync(pfxPath, pfx);
    execFileSync(
      "openssl",
      ["pkcs12", "-in", pfxPath, "-nodes", "-out", pemPath, "-passin", `pass:${password}`],
      { stdio: "pipe" },
    );
    const pem = execFileSync("openssl", ["x509", "-in", pemPath, "-noout", "-subject", "-enddate"], {
      encoding: "utf8",
    });
    const subjectMatch = /subject=([^\n]+)/.exec(pem);
    const endMatch = /notAfter=([^\n]+)/.exec(pem);
    const subject = subjectMatch?.[1]?.trim() ?? null;
    const cnpjMatch = subject?.match(/(\d{14})/);
    const expiresAt = endMatch?.[1] ? new Date(endMatch[1]) : null;
    return {
      cnpj: cnpjMatch?.[1] ?? null,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      subject,
    };
  } catch {
    return { cnpj: null, expiresAt: null, subject: null };
  } finally {
    try {
      unlinkSync(pfxPath);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(pemPath);
    } catch {
      /* ignore */
    }
  }
}

export function certificateStatus(expiresAt: Date | null): {
  valid: boolean;
  daysUntilExpiry: number | null;
  warning: boolean;
} {
  if (!expiresAt) return { valid: false, daysUntilExpiry: null, warning: true };
  const now = Date.now();
  const exp = expiresAt.getTime();
  const days = Math.floor((exp - now) / (1000 * 60 * 60 * 24));
  return {
    valid: exp > now,
    daysUntilExpiry: days,
    warning: days <= 30,
  };
}
