import { FilterBar, FormField } from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { formatOrderCode } from "@/lib/order-code";
import { expeditionSituationLabel } from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { PackageCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type QueueRow = {
  id: string;
  orderNumber?: number | null;
  status: string;
  createdAt: string;
  totalAmount: unknown;
  customer: {
    name: string;
    tradeName?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  situation: { id: string; code: string; name: string } | null;
  itemCount: number;
  unitCount: number;
  expedition: {
    status: string;
    volumeQty: number;
    startedBy: { name: string } | null;
    finishedBy: { name: string } | null;
    progress: { percent: number; complete: boolean };
  } | null;
};

function formatMoney(value: unknown) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function customerLabel(row: QueueRow) {
  return row.customer?.tradeName?.trim() || row.customer?.name || "—";
}

export function ExpeditionQueuePage() {
  const [situationCode, setSituationCode] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [city, setCity] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("status", "CONFIRMED");
    if (situationCode) p.set("situationCode", situationCode);
    if (orderNumber.trim()) p.set("orderNumber", orderNumber.trim());
    if (city.trim()) p.set("city", city.trim());
    if (tradeName.trim()) p.set("tradeName", tradeName.trim());
    if (from) p.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) p.set("to", new Date(`${to}T23:59:59`).toISOString());
    return p.toString();
  }, [situationCode, orderNumber, city, tradeName, from, to]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "expedition", "queue", qs],
    queryFn: () => apiFetch<QueueRow[]>(`/admin/expedition/orders?${qs}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Expedição</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Separe e confira pedidos com a pistola de código de barras. O estoque
          já foi baixado na confirmação da venda. Rota e romaneio aparecem
          quando o pedido estiver associado a um romaneio persistido.
        </p>
      </div>

      <FilterBar className="p-4 lg:grid-cols-6">
        <FormField label="Situação" htmlFor="exp-sit">
          <AppSelect
            id="exp-sit"
            value={situationCode}
            onValueChange={setSituationCode}
            emptyLabel="Todas"
            options={[
              { value: "OPEN", label: "Aguardando separação" },
              { value: "PICKING", label: "Em separação" },
              { value: "PACKED", label: "Separado" },
              { value: "SENT", label: "Expedido" },
            ]}
          />
        </FormField>
        <FormField label="Nº do pedido" htmlFor="exp-num">
          <Input
            id="exp-num"
            inputMode="numeric"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.replace(/\D/g, ""))}
          />
        </FormField>
        <FormField label="Cliente" htmlFor="exp-cli">
          <Input
            id="exp-cli"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
          />
        </FormField>
        <FormField label="Cidade" htmlFor="exp-city">
          <Input
            id="exp-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </FormField>
        <FormField label="De" htmlFor="exp-from">
          <Input
            id="exp-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </FormField>
        <FormField label="Até" htmlFor="exp-to">
          <Input
            id="exp-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </FormField>
      </FilterBar>

      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : null}
      {!isLoading && rows.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <PackageCheck className="h-12 w-12 text-primary/40" />
          <p className="text-muted-foreground">Nenhum pedido na fila.</p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Pedido</TableHead>
                <TableHead className="px-4">Cliente</TableHead>
                <TableHead className="px-4">Cidade</TableHead>
                <TableHead className="px-4">Data</TableHead>
                <TableHead className="px-4 text-right">Itens</TableHead>
                <TableHead className="px-4 text-right">Unidades</TableHead>
                <TableHead className="px-4 text-right">Valor</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">Romaneio</TableHead>
                <TableHead className="px-4">Responsável</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4 py-3 font-medium tabular-nums">
                    {formatOrderCode(row)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {customerLabel(row)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {row.customer?.city?.trim() || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {row.itemCount}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {row.unitCount}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(row.totalAmount)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline">
                      {expeditionSituationLabel(row.situation?.code)}
                      {row.expedition
                        ? ` · ${row.expedition.progress.percent}%`
                        : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    —
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    {row.expedition?.finishedBy?.name ||
                      row.expedition?.startedBy?.name ||
                      "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button asChild size="sm">
                      <Link to={`/expedicao/${row.id}`}>Abrir</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
