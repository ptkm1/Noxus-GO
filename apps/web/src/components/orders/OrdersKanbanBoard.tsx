import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  KANBAN_COLUMN_PAGE_SIZE,
  buildKanbanColumns,
  columnAccentClass,
  columnTotal,
  formatOrderMoney,
  groupOrdersByKanbanColumn,
  parseDraggedOrderId,
  resolveKanbanMove,
  type KanbanColumn,
  type KanbanMove,
  type KanbanSituation,
} from "@/lib/order-kanban";
import { cn } from "@/lib/utils";
import { Monitor, ShoppingCart } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  OrderKanbanCard,
  type KanbanOrder,
} from "./OrderKanbanCard";

export type KanbanBoardMove = Extract<KanbanMove, { type: "situation" }>;

type OrdersKanbanBoardProps = Readonly<{
  orders: KanbanOrder[];
  situations: KanbanSituation[];
  isLoading: boolean;
  isError: boolean;
  canDrag: boolean;
  movingId: string | null;
  onMove: (orderId: string, move: KanbanBoardMove) => void;
}>;

export function OrdersKanbanBoard({
  orders,
  situations,
  isLoading,
  isError,
  canDrag,
  movingId,
  onMove,
}: OrdersKanbanBoardProps) {
  const columns = useMemo(
    () => buildKanbanColumns(situations, orders),
    [situations, orders],
  );
  const grouped = useMemo(
    () => groupOrdersByKanbanColumn(orders, columns),
    [orders, columns],
  );
  const [visibleByColumn, setVisibleByColumn] = useState<
    Partial<Record<string, number>>
  >({});
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  function visibleCount(columnId: string): number {
    return visibleByColumn[columnId] ?? KANBAN_COLUMN_PAGE_SIZE;
  }

  function moveFor(column: KanbanColumn, orderId: string): KanbanMove | null {
    const current = orders.find((o) => o.id === orderId);
    if (!current) return null;
    return resolveKanbanMove(current, column, columns);
  }

  function dropAction(
    column: KanbanColumn,
    orderId: string,
  ): KanbanBoardMove | null {
    const move = moveFor(column, orderId);
    if (move?.type === "situation") return move;
    return null;
  }

  function handleDrop(column: KanbanColumn, event: DragEvent) {
    event.preventDefault();
    setOverColumnId(null);
    draggingIdRef.current = null;
    setDraggingId(null);
    if (!canDrag) return;
    const orderId = parseDraggedOrderId(
      event.dataTransfer.getData("text/plain"),
    );
    if (!orderId) return;
    const move = dropAction(column, orderId);
    if (!move) return;
    onMove(orderId, move);
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="flex w-70 shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar os pedidos do quadro.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground md:hidden">
        <Monitor className="mt-0.5 size-3.5 shrink-0" />
        O quadro funciona melhor no computador. No celular, deslize as colunas
        para o lado
        {canDrag
          ? " — arrastar para mudar a etapa fica limitado."
          : "."}
      </p>

      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {columns.map((column) => {
          const columnOrders = grouped[column.id] ?? [];
          const shown = columnOrders.slice(0, visibleCount(column.id));
          const hidden = columnOrders.length - shown.length;
          const total = columnTotal(columnOrders);
          const hoverMove = draggingId
            ? moveFor(column, draggingId)
            : null;
          const canDropHere =
            canDrag &&
            hoverMove?.type === "situation";
          const isOver = overColumnId === column.id && canDropHere;

          return (
            <section
              key={column.id}
              onDragOver={(e) => {
                if (!canDrag) return;
                const id = draggingIdRef.current;
                if (!id) return;
                const move = moveFor(column, id);
                if (move?.type !== "situation") {
                  e.dataTransfer.dropEffect = "none";
                  setOverColumnId(null);
                  return;
                }
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverColumnId(column.id);
              }}
              onDragLeave={(e) => {
                const next = e.relatedTarget as Node | null;
                if (next && e.currentTarget.contains(next)) return;
                setOverColumnId((cur) => (cur === column.id ? null : cur));
              }}
              onDrop={(e) => handleDrop(column, e)}
              className={cn(
                "flex max-h-[calc(100dvh-14rem)] min-h-72 w-70 shrink-0 flex-col rounded-xl border border-border bg-muted/30",
                isOver && "ring-2 ring-primary/60",
              )}
            >
              <header className="sticky top-0 z-10 shrink-0 rounded-t-xl bg-muted/80 px-3 py-2.5 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      columnAccentClass(column),
                    )}
                  />
                  <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {column.label}
                  </h2>
                  <span className="ml-auto tabular-nums text-xs text-muted-foreground">
                    {columnOrders.length}
                  </span>
                </div>
                {columnOrders.length > 0 ? (
                  <p className="mt-0.5 pl-4 text-xs tabular-nums text-muted-foreground">
                    {formatOrderMoney(total)}
                  </p>
                ) : null}
              </header>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                {shown.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-10 text-center">
                    <ShoppingCart className="size-8 text-primary/30" />
                    <p className="text-xs text-muted-foreground">
                      Nenhum pedido nesta coluna
                    </p>
                  </div>
                ) : (
                  shown.map((order) => (
                    <OrderKanbanCard
                      key={order.id}
                      order={order}
                      canDrag={canDrag}
                      isMoving={movingId === order.id}
                      onDragBegin={() => {
                        draggingIdRef.current = order.id;
                        setDraggingId(order.id);
                      }}
                      onDragFinish={() => {
                        draggingIdRef.current = null;
                        setDraggingId(null);
                        setOverColumnId(null);
                      }}
                    />
                  ))
                )}
                {hidden > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    onClick={() =>
                      setVisibleByColumn((prev) => ({
                        ...prev,
                        [column.id]:
                          visibleCount(column.id) + KANBAN_COLUMN_PAGE_SIZE,
                      }))
                    }
                  >
                    Carregar mais ({hidden})
                  </Button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
