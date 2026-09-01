import {
  AdditionalFiltersSection,
  appendExtraFilters,
  ORDER_EXTRA_FILTERS,
  type ExtraFilterRow,
} from "@/components/reports/AdditionalFilters";
import {
  DateRangeField,
  ReportField,
  ReportFormLayout,
  toIsoRange,
} from "@/components/reports/ReportFormKit";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, downloadPdf } from "@/lib/api";
import { formatOrderCode } from "@/lib/order-code";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

type Seller = { id: string; user: { name: string } };
type Customer = { id: string; name: string };

type OrderRow = {
  id: string;
  orderNumber?: number | null;
  customerId?: string | null;
  status?: string;
  situation?: { id: string; name: string } | null;
  situationId?: string | null;
  totalAmount: unknown;
  createdAt: string;
  seller: { user: { name: string } };
  customer: { id?: string; name: string } | null;
};

type StageOption = { id: string; name: string; active: boolean };

type InclusionMode = "filters" | "manual";

function selectAllState(
  allSelected: boolean,
  someSelected: boolean,
): boolean | "indeterminate" {
  if (allSelected) return true;
  if (someSelected) return "indeterminate";
  return false;
}

function formatMoney(value: unknown) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ReportOrderItemsPage() {
  const [sellerId, setSellerId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [situationId, setSituationId] = useState("");
  const [groupItems, setGroupItems] = useState(false);
  const [extras, setExtras] = useState<ExtraFilterRow[]>([]);
  const [inclusionMode, setInclusionMode] = useState<InclusionMode>("filters");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => apiFetch<Customer[]>("/admin/customers"),
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["admin", "order-situations"],
    queryFn: () => apiFetch<StageOption[]>("/admin/order-situations"),
  });

  const listQueryKey = useMemo(
    () => ["admin", "orders", "report-items-pick", sellerId, situationId],
    [sellerId, situationId],
  );

  const {
    data: ordersRaw = [],
    isLoading: ordersLoading,
    isFetching: ordersFetching,
  } = useQuery({
    queryKey: listQueryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (sellerId) params.set("sellerId", sellerId);
      if (situationId) params.set("situationId", situationId);
      const qs = params.toString();
      return apiFetch<OrderRow[]>(`/admin/orders${qs ? `?${qs}` : ""}`);
    },
    enabled: inclusionMode === "manual",
  });

  const range = useMemo(() => toIsoRange(from, to), [from, to]);

  const filteredOrders = useMemo(() => {
    const fromMs = range.from ? new Date(range.from).getTime() : null;
    const toMs = range.to ? new Date(range.to).getTime() : null;
    return ordersRaw.filter((o) => {
      if (customerId) {
        const cid = o.customerId ?? o.customer?.id;
        if (cid !== customerId) return false;
      }
      const created = new Date(o.createdAt).getTime();
      if (fromMs != null && created < fromMs) return false;
      if (toMs != null && created > toMs) return false;
      return true;
    });
  }, [ordersRaw, customerId, range.from, range.to]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [sellerId, customerId, from, to, situationId, inclusionMode]);

  const visibleIds = useMemo(
    () => filteredOrders.map((o) => o.id),
    [filteredOrders],
  );
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allSelected;

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(visibleIds) : new Set());
  }

  function clear() {
    setSellerId("");
    setCustomerId("");
    setFrom("");
    setTo("");
    setSituationId("");
    setGroupItems(false);
    setExtras([]);
    setInclusionMode("filters");
    setSelectedIds(new Set());
    setErr(null);
  }

  async function generate() {
    setErr(null);
    if (inclusionMode === "manual" && selectedIds.size === 0) {
      setErr("Selecione ao menos um pedido para gerar o relatório.");
      return;
    }
    setPending(true);
    try {
      const q = new URLSearchParams();
      if (groupItems) q.set("groupItems", "1");

      if (inclusionMode === "manual") {
        q.set("orderIds", [...selectedIds].join(","));
      } else {
        if (sellerId) q.set("sellerId", sellerId);
        if (customerId) q.set("customerId", customerId);
        if (situationId) q.set("situationId", situationId);
        const iso = toIsoRange(from, to);
        if (iso.from) q.set("from", iso.from);
        if (iso.to) q.set("to", iso.to);
        appendExtraFilters(q, extras);
      }

      await downloadPdf(
        `/admin/reports/order-items.pdf?${q.toString()}`,
        "relatorio-itens-pedidos.pdf",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar PDF");
    } finally {
      setPending(false);
    }
  }

  const manualMode = inclusionMode === "manual";
  const generateDisabled = manualMode && selectedIds.size === 0;

  return (
    <ReportFormLayout
      title="Itens de pedidos"
      onClear={clear}
      onGenerate={() => void generate()}
      generating={pending}
      generateDisabled={generateDisabled}
      className={manualMode ? "max-w-5xl" : undefined}
    >
      <ReportField label="Incluir pedidos">
        <AppSelect
          value={inclusionMode}
          onValueChange={(v) => setInclusionMode(v as InclusionMode)}
          options={[
            { value: "filters", label: "Por filtros (como antes)" },
            { value: "manual", label: "Selecionar pedidos" },
          ]}
        />
      </ReportField>

      <ReportField label="Vendedor">
        <AppSelect
          value={sellerId}
          onValueChange={setSellerId}
          emptyLabel="Todos"
          options={sellers.map((s) => ({
            value: s.id,
            label: s.user.name,
          }))}
        />
      </ReportField>
      <ReportField label="Cliente">
        <AppSelect
          value={customerId}
          onValueChange={setCustomerId}
          emptyLabel="Todos"
          options={customers.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
      </ReportField>
      <ReportField label="Emitido entre">
        <DateRangeField
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />
      </ReportField>
      <ReportField label="Etapa">
        <AppSelect
          value={situationId}
          onValueChange={setSituationId}
          emptyLabel="Todas"
          options={stages.map((s) => ({
            value: s.id,
            label: s.name,
          }))}
        />
      </ReportField>
      <ReportField label="Formato">
        <AppSelect
          value="pdf"
          onValueChange={() => undefined}
          options={[{ value: "pdf", label: "PDF" }]}
          disabled
        />
      </ReportField>
      <ReportField label="Agrupar itens">
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-2">
            <Checkbox
              checked={groupItems}
              onCheckedChange={(v) => setGroupItems(v === true)}
            />
            Somar quantidades do mesmo produto
          </span>
          <span className="text-muted-foreground pl-6">
            Desmarcado: uma seção por pedido (quebra de página).
          </span>
        </label>
      </ReportField>

      {!manualMode ? (
        <AdditionalFiltersSection
          catalog={ORDER_EXTRA_FILTERS}
          rows={extras}
          onChange={setExtras}
        />
      ) : null}

      {manualMode ? (
        <ReportField label="Selecionar pedidos" className="sm:items-start">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use os filtros acima para restringir a lista e marque os pedidos
              cujos itens devem entrar no relatório.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={visibleIds.length === 0}
                onClick={() => toggleAll(true)}
              >
                Selecionar todos
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setSelectedIds(new Set())}
              >
                Limpar seleção
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selecionado(s)
                {filteredOrders.length > 0
                  ? ` · ${filteredOrders.length} na lista`
                  : null}
              </span>
            </div>

            {ordersLoading || ordersFetching ? (
              <p className="text-sm text-muted-foreground">Carregando pedidos…</p>
            ) : filteredOrders.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum pedido encontrado com os filtros atuais.
              </p>
            ) : (
              <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 px-3">
                        <Checkbox
                          checked={selectAllState(allSelected, someSelected)}
                          onCheckedChange={(v) => toggleAll(v === true)}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead className="px-3">Nº</TableHead>
                      <TableHead className="px-3">Cliente</TableHead>
                      <TableHead className="px-3">Data</TableHead>
                      <TableHead className="px-3">Situação</TableHead>
                      <TableHead className="px-3 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((o) => {
                      const selected = selectedIds.has(o.id);
                      const code = formatOrderCode(o);
                      return (
                        <TableRow
                          key={o.id}
                          className={cn(selected && "bg-muted/40")}
                        >
                          <TableCell className="px-3 py-2">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(v) =>
                                toggleOne(o.id, v === true)
                              }
                              aria-label={`Selecionar pedido ${code}`}
                            />
                          </TableCell>
                          <TableCell className="px-3 py-2 font-medium tabular-nums">
                            {code}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            {o.customer?.name ?? "—"}
                          </TableCell>
                          <TableCell className="px-3 py-2 whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(o.createdAt).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm">
                            {o.situation?.name ?? "—"}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(o.totalAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </ReportField>
      ) : null}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </ReportFormLayout>
  );
}
