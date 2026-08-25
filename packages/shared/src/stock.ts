import { formatStockQtyWithUnit } from "./product-display.js";

export type StockMovementType =
  | "MANUAL_IN"
  | "MANUAL_OUT"
  | "MANUAL_ADJUST"
  | "ADJUST"
  | "SALE"
  | "SALE_REVERSAL"
  | "INBOUND_INVOICE"
  | "OUTBOUND_INVOICE";

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  MANUAL_IN: "Entrada manual",
  MANUAL_OUT: "Saída manual",
  MANUAL_ADJUST: "Ajuste de inventário",
  ADJUST: "Ajuste de lote",
  SALE: "Venda",
  SALE_REVERSAL: "Estorno de venda",
  INBOUND_INVOICE: "NF-e de entrada",
  OUTBOUND_INVOICE: "NF-e de saída",
};

/** Rótulos curtos para auditoria / listagens (ex.: "Entrada - 500 fardos"). */
export const STOCK_MOVEMENT_TYPE_SHORT_LABELS: Record<
  StockMovementType,
  string
> = {
  MANUAL_IN: "Entrada",
  MANUAL_OUT: "Saída",
  MANUAL_ADJUST: "Ajuste",
  ADJUST: "Ajuste",
  SALE: "Venda",
  SALE_REVERSAL: "Estorno",
  INBOUND_INVOICE: "NF-e entrada",
  OUTBOUND_INVOICE: "NF-e saída",
};

export function stockMovementTypeLabel(
  type: string | null | undefined,
  opts?: { short?: boolean },
): string {
  if (!type) return "Movimentação";
  const map = opts?.short
    ? STOCK_MOVEMENT_TYPE_SHORT_LABELS
    : STOCK_MOVEMENT_TYPE_LABELS;
  return (map as Record<string, string>)[type] ?? type;
}

/**
 * Detalhes humanos de auditoria de estoque a partir de metadata estruturado
 * (ou campos já parseados de string legada).
 * Ex.: "Entrada - 500 fardos · lote 153"
 */
export function formatStockAuditDetails(
  meta: Record<string, unknown>,
): string | null {
  const movementType =
    typeof meta.movementType === "string" ? meta.movementType : null;
  const qty = readNumericMeta(meta.qtyDelta ?? meta.qty);
  if (movementType == null && qty == null) return null;

  const typeLabel = stockMovementTypeLabel(movementType, { short: true });
  const unit = readStringMeta(meta.unitLabel) ?? readStringMeta(meta.unit);

  const parts: string[] = [];
  if (qty != null) {
    parts.push(`${typeLabel} - ${formatStockQtyWithUnit(qty, unit)}`);
  } else {
    parts.push(typeLabel);
  }

  const lotCode = readStringMeta(meta.lotCode);
  if (lotCode) parts.push(`lote ${lotCode}`);

  const reason = readStringMeta(meta.reason);
  if (reason) parts.push(reason);

  return parts.join(" · ");
}

function readStringMeta(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function readNumericMeta(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
