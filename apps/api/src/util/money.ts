/** Valores monetários vindos do Prisma (`Decimal`) ou JSON (`string`). */
export function decToNum(v: unknown): number {
  if (typeof v === "number") return v;
  return Number(v);
}
