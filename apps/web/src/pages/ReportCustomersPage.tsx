import {
  AdditionalFiltersSection,
  appendExtraFilters,
  CUSTOMER_EXTRA_FILTERS,
  type ExtraFilterRow,
} from "@/components/reports/AdditionalFilters";
import {
  ReportField,
  ReportFormLayout,
} from "@/components/reports/ReportFormKit";
import { AppSelect } from "@/components/ui/app-select";
import { apiFetch, downloadPdf } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type Seller = { id: string; user: { name: string } };
type Customer = { id: string; name: string };

export function ReportCustomersPage() {
  const [sellerId, setSellerId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [creditStatus, setCreditStatus] = useState("");
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
    setCreditStatus("");
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
      if (creditStatus === "blocked" || creditStatus === "ok") {
        q.set("creditStatus", creditStatus);
      }
      appendExtraFilters(q, extras);
      await downloadPdf(
        `/admin/reports/customers.pdf?${q.toString()}`,
        "relatorio-clientes.pdf",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar PDF");
    } finally {
      setPending(false);
    }
  }

  return (
    <ReportFormLayout
      title="Relatório de Clientes"
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
      <ReportField label="Situação">
        <AppSelect
          value={creditStatus}
          onValueChange={setCreditStatus}
          emptyLabel="Todos"
          options={[
            { value: "ok", label: "Crédito OK" },
            { value: "blocked", label: "Crédito bloqueado" },
          ]}
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
      <AdditionalFiltersSection
        catalog={CUSTOMER_EXTRA_FILTERS}
        rows={extras}
        onChange={setExtras}
      />
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </ReportFormLayout>
  );
}
