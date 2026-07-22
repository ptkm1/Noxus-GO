import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, downloadXml } from "../lib/api";

type FiscalOrder = {
  id: string;
  code: string;
  orderNumber: number | null;
  totalAmount: number;
  createdAt: string;
  customerName: string;
  sellerName: string;
  itemCount: number;
};

export function FiscalXmlPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const query = qs.toString();

  const {
    data: orders = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin", "fiscal-orders", from, to],
    queryFn: () =>
      apiFetch<FiscalOrder[]>(
        `/admin/fiscal/orders${query ? `?${query}` : ""}`,
      ),
  });

  async function handleDownload(order: FiscalOrder) {
    setError(null);
    setDownloadingId(order.id);
    try {
      await downloadXml(
        `/admin/orders/${order.id}/nfe.xml`,
        `nfe-${order.code}.xml`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao baixar XML");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadAll() {
    setError(null);
    setDownloadingAll(true);
    try {
      const fromPart = from.replace(/-/g, "") || "inicio";
      const toPart = to.replace(/-/g, "") || "fim";
      await downloadXml(
        `/admin/fiscal/orders/nfe.zip${query ? `?${query}` : ""}`,
        `nfe-xml-${fromPart}-${toPart}.zip`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Falha ao baixar ZIP com os XMLs",
      );
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/fiscal" className="hover:text-foreground">
            Fiscal
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">Exportar XML NF-e</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">
          Exportar XML NF-e
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          XML provisório gerado a partir do pedido confirmado. Não substitui a
          autorização na SEFAZ.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">De</label>
          <DatePicker value={from} onChange={setFrom} placeholder="De" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Até
          </label>
          <DatePicker value={to} onChange={setTo} placeholder="Até" />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          Filtrar
        </Button>
        <Button
          type="button"
          onClick={() => void handleDownloadAll()}
          disabled={downloadingAll || isLoading || orders.length === 0}
        >
          {downloadingAll
            ? "Gerando ZIP…"
            : `Baixar todos (${orders.length})`}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando pedidos…</p>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Nenhum pedido confirmado no período.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.code}</TableCell>
                  <TableCell>
                    {new Date(o.createdAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{o.customerName}</TableCell>
                  <TableCell>{o.sellerName}</TableCell>
                  <TableCell>{o.itemCount}</TableCell>
                  <TableCell>
                    {o.totalAmount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={downloadingId === o.id}
                      onClick={() => void handleDownload(o)}
                    >
                      {downloadingId === o.id ? "Baixando…" : "Baixar XML"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
