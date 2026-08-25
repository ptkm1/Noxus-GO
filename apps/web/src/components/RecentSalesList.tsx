import { cn } from "@/lib/utils";
import { formatOrderCode } from "@/lib/order-code";
import {
  formatRelativeSaleDate,
  formatSaleItemCount,
  paymentConditionLabel,
} from "@pedidos/shared";
import { Loader2, MoreHorizontal, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export type RecentSaleOrder = {
  id: string;
  orderNumber?: number | null;
  status: string;
  totalAmount: unknown;
  createdAt: string;
  paymentCondition?: {
    id: string;
    name: string;
    days: number;
    sortOrder: number;
  } | null;
  customer: {
    name: string;
    city?: string | null;
    tradeName?: string | null;
  } | null;
  items: { id?: string; quantity?: number }[];
  seller?: { user: { name: string } };
};

type Props = {
  orders: RecentSaleOrder[];
  isLoading?: boolean;
  isFetching?: boolean;
  limit?: number;
  viewAllHref?: string;
  subtitle?: string;
  showSeller?: boolean;
};

function fmtMoney(value: unknown): string {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function customerLabel(order: RecentSaleOrder): string {
  return (
    order.customer?.tradeName?.trim() ||
    order.customer?.name ||
    "Sem cliente"
  );
}

function metaParts(order: RecentSaleOrder, showSeller: boolean): string[] {
  const parts: string[] = [];
  const city = order.customer?.city?.trim();
  if (city) parts.push(city);
  parts.push(paymentConditionLabel(order.paymentCondition));
  if (showSeller && order.seller?.user.name) {
    parts.push(order.seller.user.name);
  }
  parts.push(formatSaleItemCount(order.items.length));
  return parts;
}

export function RecentSalesList({
  orders,
  isLoading = false,
  isFetching = false,
  limit = 8,
  viewAllHref = "/pedidos",
  subtitle = "Pedidos mais recentes da organização.",
  showSeller = true,
}: Props) {
  const visible = orders.slice(0, limit);
  const isRefetching = isFetching && !isLoading;

  return (
    <section className="surface-card relative mt-6 overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">
            Vendas recentes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Link
          to={viewAllHref}
          className="shrink-0 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-muted"
        >
          Ver todas
        </Link>
      </div>

      {isLoading ? (
        <ul className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="ml-auto h-4 w-20" />
                <Skeleton className="ml-auto h-3 w-14" />
              </div>
            </li>
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
          Nenhuma venda registrada ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((order) => {
            const confirmed = order.status === "CONFIRMED";
            const code = formatOrderCode(order);
            const meta = metaParts(order, showSeller);
            return (
              <li key={order.id}>
                <Link
                  to={`/pedidos/${order.id}`}
                  aria-label={`Pedido ${code}, ${customerLabel(order)}`}
                  className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:gap-4 sm:px-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium tabular-nums text-muted-foreground">
                      Pedido {code}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                      {customerLabel(order)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {meta.join(" · ")}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        confirmed ? "text-success" : "text-foreground",
                      )}
                    >
                      {fmtMoney(order.totalAmount)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelativeSaleDate(order.createdAt)}
                    </p>
                  </div>

                  <span
                    className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {isRefetching ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]"
          aria-busy
          aria-label="Atualizando vendas"
        >
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : null}
    </section>
  );
}
