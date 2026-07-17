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
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch, downloadPdf } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type Seller = { id: string; user: { name: string } };
type Customer = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "PENDING_CREDIT_APPROVAL", label: "Aguardando crédito" },
];

export function ReportOrderItemsPage() {
  const [sellerId, setSellerId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [groupByOrder, setGroupByOrder] = useState(true);
  const [extras, setExtras] = useState<ExtraFilterRow[]>([]);
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

  function clear() {
    setSellerId("");
    setCustomerId("");
    setFrom("");
    setTo("");
    setStatus("");
    setGroupByOrder(true);
    setExtras([]);
    setErr(null);
  }

  async function generate() {
    setErr(null);
    setPending(true);
    try {
      const q = new URLSearchParams();
      if (sellerId) q.set("sellerId", sellerId);
      if (customerId) q.set("customerId", customerId);
      if (status) q.set("status", status);
      if (groupByOrder) q.set("groupByOrder", "1");
      const range = toIsoRange(from, to);
      if (range.from) q.set("from", range.from);
      if (range.to) q.set("to", range.to);
      appendExtraFilters(q, extras);
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

  return (
    <ReportFormLayout
      title="Relatório de Itens de Pedidos"
      onClear={clear}
      onGenerate={() => void generate()}
      generating={pending}
    >
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
      <ReportField label="Situação">
        <AppSelect
          value={status}
          onValueChange={setStatus}
          emptyLabel="Todos"
          options={STATUS_OPTIONS}
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
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={groupByOrder}
            onCheckedChange={(v) => setGroupByOrder(v === true)}
          />
          Segregar por pedido (quebra de página)
        </label>
      </ReportField>
      <AdditionalFiltersSection
        catalog={ORDER_EXTRA_FILTERS}
        rows={extras}
        onChange={setExtras}
      />
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </ReportFormLayout>
  );
}
