import { ORDER_STATUSES, orderStatusLabel, type OrderStatus } from "@pedidos/shared";

/** Colunas de status antes da confirmação (a expedição entra pelas situações). */
export const KANBAN_PRECONFIRM_STATUSES: OrderStatus[] = [
  "DRAFT",
  "PENDING_CREDIT_APPROVAL",
];

export const KANBAN_COLUMN_PAGE_SIZE = 8;

export type KanbanSituation = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  mapsToCancel?: boolean;
};

export type KanbanOrderLike = {
  id: string;
  status: string;
  situationId?: string | null;
  situation?: {
    id?: string;
    code?: string;
    name?: string;
    sortOrder?: number;
    active?: boolean;
    mapsToCancel?: boolean;
  } | null;
};

export type KanbanColumn = {
  id: string;
  kind: "status" | "situation";
  label: string;
  status?: OrderStatus;
  situationId?: string;
  situationCode?: string;
  mapsToCancel?: boolean;
  /** Primeira situação operacional (ex.: Aberto): destino de confirmação no quadro. */
  isFulfillmentEntry?: boolean;
};

export type KanbanMove =
  | { type: "status"; status: OrderStatus }
  | { type: "situation"; situationId: string }
  | { type: "invalid" }
  | { type: "noop" };

export function statusColumnId(status: OrderStatus): string {
  return `status:${status}`;
}

export function situationColumnId(situationId: string): string {
  return `situation:${situationId}`;
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
    case "CANCELLED":
      return "border-transparent bg-destructive/15 text-destructive";
    case "PENDING_CREDIT_APPROVAL":
      return "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

export function columnAccentClass(column: KanbanColumn): string {
  if (column.kind === "status") {
    switch (column.status) {
      case "CONFIRMED":
        return "bg-emerald-500";
      case "CANCELLED":
        return "bg-destructive";
      case "PENDING_CREDIT_APPROVAL":
        return "bg-amber-500";
      default:
        return "bg-muted-foreground/50";
    }
  }
  switch (column.situationCode) {
    case "DELIVERED":
      return "bg-emerald-500";
    case "SENT":
      return "bg-sky-500";
    case "PACKED":
      return "bg-violet-500";
    case "PICKING":
      return "bg-amber-500";
    case "OPEN":
      return "bg-blue-500";
    default:
      return column.mapsToCancel
        ? "bg-destructive"
        : "bg-muted-foreground/50";
  }
}

function situationIdOf(order: KanbanOrderLike): string | null {
  return order.situationId ?? order.situation?.id ?? null;
}

function catalogById(
  situations: KanbanSituation[],
): Map<string, KanbanSituation> {
  return new Map(situations.map((s) => [s.id, s]));
}

/** Situações visíveis no board: ativas de fulfillment na ordem do cadastro + as ainda usadas. */
export function situationsForKanban(
  situations: KanbanSituation[],
  orders: KanbanOrderLike[],
): KanbanSituation[] {
  const byId = catalogById(situations);
  const selected = new Map<string, KanbanSituation>();

  const sorted = [...situations].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
  for (const s of sorted) {
    if (s.active && !s.mapsToCancel) selected.set(s.id, s);
  }

  for (const order of orders) {
    if (order.status !== "CONFIRMED") continue;
    const id = situationIdOf(order);
    if (!id || selected.has(id)) continue;
    const fromCatalog = byId.get(id);
    if (fromCatalog) {
      selected.set(id, fromCatalog);
      continue;
    }
    const fromOrder = order.situation;
    selected.set(id, {
      id,
      code: fromOrder?.code ?? "",
      name: fromOrder?.name ?? "Situação",
      sortOrder: fromOrder?.sortOrder ?? 9999,
      active: fromOrder?.active ?? false,
      mapsToCancel: fromOrder?.mapsToCancel ?? false,
    });
  }

  return [...selected.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
}

export function buildKanbanColumns(
  situations: KanbanSituation[],
  orders: KanbanOrderLike[] = [],
): KanbanColumn[] {
  const fulfillment = situationsForKanban(situations, orders);
  const entry = fulfillment.find((s) => !s.mapsToCancel) ?? fulfillment[0];

  const columns: KanbanColumn[] = KANBAN_PRECONFIRM_STATUSES.map((status) => ({
    id: statusColumnId(status),
    kind: "status",
    label: orderStatusLabel(status),
    status,
  }));

  for (const s of fulfillment) {
    columns.push({
      id: situationColumnId(s.id),
      kind: "situation",
      label: s.name,
      situationId: s.id,
      situationCode: s.code,
      mapsToCancel: s.mapsToCancel,
      isFulfillmentEntry: entry?.id === s.id,
    });
  }

  if (fulfillment.length === 0) {
    columns.push({
      id: statusColumnId("CONFIRMED"),
      kind: "status",
      label: orderStatusLabel("CONFIRMED"),
      status: "CONFIRMED",
    });
  }

  columns.push({
    id: statusColumnId("CANCELLED"),
    kind: "status",
    label: orderStatusLabel("CANCELLED"),
    status: "CANCELLED",
  });

  return columns;
}

export function columnIdForOrder(
  order: KanbanOrderLike,
  columns: KanbanColumn[],
): string {
  if (order.status === "CANCELLED") return statusColumnId("CANCELLED");
  if (order.status === "DRAFT") return statusColumnId("DRAFT");
  if (order.status === "PENDING_CREDIT_APPROVAL") {
    return statusColumnId("PENDING_CREDIT_APPROVAL");
  }
  if (order.status === "CONFIRMED") {
    const sitId = situationIdOf(order);
    if (sitId) {
      const match = columns.find(
        (c) => c.kind === "situation" && c.situationId === sitId,
      );
      if (match) return match.id;
    }
    const entry = columns.find((c) => c.isFulfillmentEntry);
    if (entry) return entry.id;
    return statusColumnId("CONFIRMED");
  }
  return ORDER_STATUSES.includes(order.status as OrderStatus)
    ? statusColumnId(order.status as OrderStatus)
    : statusColumnId("DRAFT");
}

export function groupOrdersByKanbanColumn<T extends KanbanOrderLike>(
  orders: T[],
  columns: KanbanColumn[],
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const col of columns) grouped[col.id] = [];
  for (const order of orders) {
    const key = columnIdForOrder(order, columns);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(order);
  }
  return grouped;
}

export function resolveKanbanMove(
  order: KanbanOrderLike,
  target: KanbanColumn,
  columns: KanbanColumn[],
): KanbanMove {
  const currentId = columnIdForOrder(order, columns);
  if (currentId === target.id) return { type: "noop" };

  if (target.kind === "status") {
    if (!target.status) return { type: "invalid" };
    if (order.status === target.status) return { type: "noop" };
    return { type: "status", status: target.status };
  }

  if (!target.situationId) return { type: "invalid" };

  if (order.status === "CONFIRMED") {
    if (situationIdOf(order) === target.situationId) return { type: "noop" };
    return { type: "situation", situationId: target.situationId };
  }

  // Rascunho / crédito / cancelado: só a primeira situação confirma (não “pula” para Entregue).
  if (target.isFulfillmentEntry) {
    return { type: "status", status: "CONFIRMED" };
  }
  return { type: "invalid" };
}

export function parseDraggedOrderId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("order:")) {
    const id = value.slice("order:".length).trim();
    return id.length > 0 ? id : null;
  }
  if (value.includes("/") || value.includes(":")) return null;
  return value;
}

export function columnTotal(orders: { totalAmount: unknown }[]): number {
  return orders.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
}

export function formatOrderMoney(value: unknown): string {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
