import { randomInt } from "node:crypto";
import { UF_IBGE } from "./sefaz-endpoints.js";

function mod11Digit(digits: string): string {
  let weight = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  const dv = 11 - mod;
  if (dv === 0 || dv === 10 || dv === 11) return "0";
  return String(dv);
}

export function generateAccessKey(input: {
  uf: string;
  issuedAt: Date;
  cnpj: string;
  model?: string;
  series: number;
  number: number;
  tpEmis?: string;
}): string {
  const cUF = UF_IBGE[input.uf.toUpperCase()] ?? "35";
  const dt = input.issuedAt;
  const aamm = `${String(dt.getFullYear()).slice(-2)}${String(dt.getMonth() + 1).padStart(2, "0")}`;
  const cnpj = input.cnpj.replace(/\D/g, "").padStart(14, "0").slice(0, 14);
  const mod = input.model ?? "55";
  const serie = String(input.series).padStart(3, "0");
  const nNF = String(input.number).padStart(9, "0");
  const tpEmis = input.tpEmis ?? "1";
  const cNF = String(randomInt(0, 100_000_000)).padStart(8, "0");
  const base = `${cUF}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  return `${base}${mod11Digit(base)}`;
}

export function onlyDigits(value: string, len?: number): string {
  const d = value.replace(/\D/g, "");
  return len ? d.padStart(len, "0").slice(-len) : d;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatNfeDecimal(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}
