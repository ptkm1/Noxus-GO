import {
  AdditionalFiltersSection,
  appendExtraFilters,
  STOCK_EXTRA_FILTERS,
  type ExtraFilterRow,
} from "@/components/reports/AdditionalFilters";
import {
  ReportField,
  ReportFormLayout,
} from "@/components/reports/ReportFormKit";
import { AppSelect } from "@/components/ui/app-select";
import { Input } from "@/components/ui/input";
import { apiFetch, downloadPdf } from "@/lib/api";
import {
  STOCK_COUNT_SORT_OPTIONS,
  STOCK_SITUATION_OPTIONS,
  type StockCountSortBy,
  type StockSituation,
} from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type Category = { id: string; name: string };
type Supplier = { id: string; tradeName: string; legalName: string };

export function ReportStockCountPage() {
  const [supplierId, setSupplierId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const [stockSituation, setStockSituation] =
    useState<StockSituation>("with_stock");
  const [sortBy, setSortBy] = useState<StockCountSortBy>("name");
  const [extras, setExtras] = useState<ExtraFilterRow[]>([]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "product-categories"],
    queryFn: () => apiFetch<Category[]>("/admin/product-categories"),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/admin/suppliers"),
  });

  function clear() {
    setSupplierId("");
    setCategoryId("");
    setQ("");
    setStockSituation("with_stock");
    setSortBy("name");
    setExtras([]);
    setErr(null);
  }

  async function generate() {
    setErr(null);
    setPending(true);
    try {
      const params = new URLSearchParams();
      if (supplierId) params.set("supplierId", supplierId);
      if (categoryId) params.set("categoryId", categoryId);
      if (q.trim()) params.set("q", q.trim());
      if (stockSituation !== "with_stock") {
        params.set("stockSituation", stockSituation);
      }
      params.set("sortBy", sortBy);
      appendExtraFilters(params, extras);
      await downloadPdf(
        `/admin/reports/stock-count.pdf?${params.toString()}`,
        "lista-contagem-estoque.pdf",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar PDF");
    } finally {
      setPending(false);
    }
  }

  return (
    <ReportFormLayout
      title="Lista para Contagem de Estoque"
      onClear={clear}
      onGenerate={() => void generate()}
      generating={pending}
    >
      <ReportField label="Fornecedor">
        <AppSelect
          value={supplierId}
          onValueChange={setSupplierId}
          emptyLabel="Todos"
          options={suppliers.map((s) => ({
            value: s.id,
            label: s.tradeName || s.legalName,
          }))}
        />
      </ReportField>
      <ReportField label="Grupo">
        <AppSelect
          value={categoryId}
          onValueChange={setCategoryId}
          emptyLabel="Todos"
          options={categories.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
      </ReportField>
      <ReportField label="Buscar">
        <Input
          placeholder="Nome, SKU ou código de barras"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </ReportField>
      <ReportField label="Situação do estoque">
        <AppSelect
          value={stockSituation}
          onValueChange={(v) => setStockSituation(v as StockSituation)}
          options={STOCK_SITUATION_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </ReportField>
      <ReportField label="Ordenar por">
        <AppSelect
          value={sortBy}
          onValueChange={(v) => setSortBy(v as StockCountSortBy)}
          options={STOCK_COUNT_SORT_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
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
      <AdditionalFiltersSection
        catalog={STOCK_EXTRA_FILTERS}
        rows={extras}
        onChange={setExtras}
      />
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </ReportFormLayout>
  );
}
