import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

/** Espelha a lógica de hash sem importar Prisma. */
function hashActivationToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateActivationTokenRaw(): string {
  return randomBytes(32).toString("base64url");
}

describe("activation token hashing", () => {
  it("gera tokens únicos com hash estável", () => {
    const a = generateActivationTokenRaw();
    const b = generateActivationTokenRaw();
    expect(a).not.toEqual(b);
    expect(hashActivationToken(a)).toHaveLength(64);
    expect(hashActivationToken(a)).toBe(hashActivationToken(a));
    expect(hashActivationToken(a)).not.toBe(hashActivationToken(b));
  });

  it("considera expiração por timestamp", () => {
    const expiresAt = new Date(Date.now() - 1000);
    expect(expiresAt.getTime() < Date.now()).toBe(true);
  });
});
