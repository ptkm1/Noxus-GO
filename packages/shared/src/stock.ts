export type StockMovementType =
  | "MANUAL_IN"
  | "MANUAL_OUT"
  | "MANUAL_ADJUST"
  | "INBOUND_INVOICE"
  | "OUTBOUND_INVOICE";

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  MANUAL_IN: "Entrada manual",
  MANUAL_OUT: "Saída manual",
  MANUAL_ADJUST: "Ajuste de inventário",
  INBOUND_INVOICE: "NF-e de entrada",
  OUTBOUND_INVOICE: "NF-e de saída",
};
