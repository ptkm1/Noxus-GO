import { AppSelect } from "@/components/ui/app-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ORDER_STATUSES, orderStatusLabel } from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, downloadPdf, printPdf } from "../lib/api";

type Order = {
  id: string;
  status: string;
  totalAmount: unknown;
  notes: string | null;
  creditHoldReasons?: unknown;
  createdAt: string;
  seller: { user: { name: string; email: string } };
  customer: { name: string; email: string | null } | null;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: unknown;
    product: { name: string; sku: string | null };
  }[];
};

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const qc = useQueryClient();
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin", "order", orderId],
    queryFn: () => apiFetch<Order>(`/admin/orders/${orderId}`),
    enabled: !!orderId,
  });

  const patchStatus = useMutation({
    mutationFn: (status: string) =>
      apiFetch(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "order", orderId] });
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({
        queryKey: ["admin", "pending-credit-summary"],
      });
      void qc.invalidateQueries({
        queryKey: ["admin", "notifications-unread"],
      });
    },
  });

  if (!orderId) return null;

  async function handlePrintPdf() {
    if (!orderId) return;
    setPdfErr(null);
    setPdfPending(true);
    try {
      await printPdf(`/admin/orders/${orderId}/pdf`);
    } catch {
      setPdfErr("Não foi possível gerar o PDF para impressão.");
    } finally {
      setPdfPending(false);
    }
  }

  async function handleDownloadPdf() {
    if (!orderId) return;
    setPdfErr(null);
    setPdfPending(true);
    try {
      await downloadPdf(
        `/admin/orders/${orderId}/pdf`,
        `pedido-${orderId.slice(0, 8)}.pdf`,
      );
    } catch {
      setPdfErr("Não foi possível baixar o PDF.");
    } finally {
      setPdfPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/vendas" className="text-sm text-primary">
        ← Todas as vendas
      </Link>

      {isLoading || !order ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">
                Venda {order.id.slice(0, 8)}…
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(order.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                onClick={() => void handlePrintPdf()}
                disabled={pdfPending}
              >
                {pdfPending ? "Gerando…" : "Imprimir pedido"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                onClick={() => void handleDownloadPdf()}
                disabled={pdfPending}
              >
                Baixar PDF
              </button>
              <span className="text-sm text-muted-foreground">Status:</span>
              <AppSelect
                value={order.status}
                disabled={patchStatus.isPending}
                triggerClassName="w-auto min-w-[10rem]"
                options={ORDER_STATUSES.map((s) => ({
                  value: s,
                  label: orderStatusLabel(s),
                }))}
                onValueChange={(v) => patchStatus.mutate(v)}
              />
            </div>
          </div>

          {pdfErr ? (
            <p className="mt-4 text-sm text-destructive">{pdfErr}</p>
          ) : null}

          <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Vendedor</dt>
              <dd className="font-medium">
                {order.seller.user.name} ({order.seller.user.email})
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="font-medium">{order.customer?.name ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">
                Motivos de crédito (se aguardando)
              </dt>
              <dd className="whitespace-pre-wrap font-mono text-xs text-foreground">
                {order.creditHoldReasons != null
                  ? JSON.stringify(order.creditHoldReasons, null, 2)
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Observações</dt>
              <dd>{order.notes ?? "—"}</dd>
            </div>
          </dl>

          <h2 className="mt-8 font-medium">Itens</h2>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead className="pb-2">Produto</TableHead>
                <TableHead className="pb-2">Qtd</TableHead>
                <TableHead className="pb-2">Preço unit.</TableHead>
                <TableHead className="pb-2">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="py-2">{it.productName}</TableCell>
                  <TableCell>{it.quantity}</TableCell>
                  <TableCell>R$ {Number(it.unitPrice).toFixed(2)}</TableCell>
                  <TableCell>
                    R$ {(Number(it.unitPrice) * it.quantity).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-right text-lg font-semibold">
            Total: R$ {Number(order.totalAmount).toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
