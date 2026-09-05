import type { ReceivableStatus } from "@prisma/client";

/**
 * Mapeamentos genéricos + por provedor.
 * Só inclui status documentados publicamente; desconhecido → PENDING.
 */

const GENERIC: Record<string, ReceivableStatus> = {
  PENDING: "PENDING",
  OPEN: "PENDING",
  ATIVO: "PENDING",
  REGISTERED: "PENDING",
  EMITIDO: "PENDING",
  PROCESSING: "PROCESSING",
  PROCESSANDO: "PROCESSING",
  EM_PROCESSAMENTO: "PROCESSING",
  PAID: "PAID",
  LIQUIDADO: "PAID",
  SETTLED: "PAID",
  RECEBIDO: "PAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  "LIQUIDADO PARCIALMENTE": "PARTIALLY_PAID",
  LIQUIDADO_PARCIALMENTE: "PARTIALLY_PAID",
  OVERDUE: "OVERDUE",
  VENCIDO: "OVERDUE",
  EXPIRED: "OVERDUE",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
  BAIXADO: "CANCELLED",
  CANCELADO: "CANCELLED",
  WRITE_OFF: "CANCELLED",
  ERROR: "ERROR",
  ERRO: "ERROR",
  FAILED: "ERROR",
  FALHA: "ERROR",
};

/** Santander — lista pública: Ativo | Baixado | Liquidado | Liquidado parcialmente */
const SANTANDER: Record<string, ReceivableStatus> = {
  ATIVO: "PENDING",
  BAIXADO: "CANCELLED",
  LIQUIDADO: "PAID",
  "LIQUIDADO PARCIALMENTE": "PARTIALLY_PAID",
};

/** BB — códigos comuns em manuais de cobrança (quando a API devolve situacao). */
const BB: Record<string, ReceivableStatus> = {
  "1": "PENDING",
  "2": "OVERDUE",
  "6": "PAID",
  "7": "CANCELLED",
  A: "PENDING",
  B: "OVERDUE",
  L: "PAID",
  BAIXADO: "CANCELLED",
};

/** Itaú — stubs até OpenAPI do portal; aceita labels genéricos. */
const ITAU: Record<string, ReceivableStatus> = {
  ...GENERIC,
};

function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

export function mapGenericExternalStatus(external: string): ReceivableStatus {
  const key = normalize(external);
  return GENERIC[key] ?? GENERIC[key.replace(/ /g, "_")] ?? "PENDING";
}

export function mapSantanderExternalStatus(external: string): ReceivableStatus {
  const key = normalize(external);
  return SANTANDER[key] ?? mapGenericExternalStatus(external);
}

export function mapBbExternalStatus(external: string): ReceivableStatus {
  const key = normalize(external);
  return BB[key] ?? mapGenericExternalStatus(external);
}

export function mapItauExternalStatus(external: string): ReceivableStatus {
  const key = normalize(external);
  return ITAU[key] ?? mapGenericExternalStatus(external);
}

/** Se vencido e ainda aberto, promove para OVERDUE. */
export function applyDueDateOverdue(
  status: ReceivableStatus,
  dueDate: Date,
  at: Date = new Date(),
): ReceivableStatus {
  if (
    status !== "PENDING" &&
    status !== "PARTIALLY_PAID" &&
    status !== "PROCESSING"
  ) {
    return status;
  }
  const today0 = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const due0 = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );
  if (due0 < today0) return "OVERDUE";
  return status;
}
