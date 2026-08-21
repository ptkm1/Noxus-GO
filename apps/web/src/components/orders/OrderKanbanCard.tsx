import { Badge } from "@/components/ui/badge";
import { formatOrderCode } from "@/lib/order-code";
import { formatOrderMoney, statusBadgeClass } from "@/lib/order-kanban";
import { cn } from "@/lib/utils";
import { orderStatusLabel } from "@pedidos/shared";
import { useRef } from "react";
import { Link } from "react-router-dom";

export type KanbanOrder = {
  id: string;
  orderNumber?: number | null;
  status: string;
  situationId?: string | null;
  situation?: { id?: string; name: string; code?: string } | null;
  totalAmount: unknown;
  createdAt: string;
  seller: { user: { name: string } };
  customer: {
    name: string;
    city?: string | null;
    tradeName?: string | null;
  } | null;
  items: { id: string }[];
};

type OrderKanbanCardProps = Readonly<{
  order: KanbanOrder;
  canDrag: boolean;
  isMoving: boolean;
  /** Na coluna de status, mostra a situação; na de situação, mostra o status. */
  showSituation: boolean;
  onDragBegin?: () => void;
  onDragFinish?: () => void;
}>;

export function OrderKanbanCard({
  order,
  canDrag,
  isMoving,
  showSituation,
  onDragBegin,
  onDragFinish,
}: OrderKanbanCardProps) {
  const dragMoved = useRef(false);
  const code = formatOrderCode(order);
  const customerName =
    order.customer?.tradeName?.trim() || order.customer?.name || "—";
  const city = order.customer?.city?.trim();

  return (
    <Link
      to={`/pedidos/${order.id}`}
      draggable={canDrag}
      onDragStart={(e) => {
        dragMoved.current = false;
        e.dataTransfer.setData("text/plain", `order:${order.id}`);
        e.dataTransfer.effectAllowed = "move";
        onDragBegin?.();
      }}
      onDrag={() => {
        dragMoved.current = true;
      }}
      onDragOver={(e) => {
        if (!canDrag) return;
        e.preventDefault();
      }}
      onDragEnd={() => {
        onDragFinish?.();
        window.setTimeout(() => {
          dragMoved.current = false;
        }, 0);
      }}
      onClick={(e) => {
        if (dragMoved.current) {
          e.preventDefault();
          dragMoved.current = false;
        }
      }}
      aria-label={`Pedido ${code}, ${customerName}`}
      className={cn(
        "surface-card block rounded-lg p-3 text-left no-underline shadow-none transition-shadow hover:shadow-sm",
        canDrag && "cursor-grab active:cursor-grabbing",
        isMoving && "opacity-60",
      )}
    >
      <p className="text-sm font-semibold tabular-nums text-foreground">
        Pedido {code}
      </p>
      <p className="mt-1.5 truncate text-sm font-medium text-foreground">
        {customerName}
      </p>
      {city ? (
        <p className="truncate text-xs text-muted-foreground">{city}</p>
      ) : null}
      <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
        {formatOrderMoney(order.totalAmount)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{order.seller.user.name}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {order.items.length} {order.items.length === 1 ? "item" : "itens"}
        </span>
      </div>
      {showSituation && order.situation?.name ? (
        <Badge variant="secondary" className="mt-2 font-normal">
          {order.situation.name}
        </Badge>
      ) : null}
      {!showSituation ? (
        <Badge
          variant="outline"
          className={cn("mt-2 font-normal", statusBadgeClass(order.status))}
        >
          {orderStatusLabel(order.status)}
        </Badge>
      ) : null}
    </Link>
  );
}
