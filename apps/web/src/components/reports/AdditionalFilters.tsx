import { AppSelect } from "@/components/ui/app-select";
import { Input } from "@/components/ui/input";
import { Plus, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ReportField } from "./ReportFormKit";

export type ExtraFilterKind = "text" | "number" | "boolean" | "select";

export type ExtraFilterDef = {
  key: string;
  label: string;
  kind: ExtraFilterKind;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export type ExtraFilterRow = {
  id: string;
  key: string;
  value: string;
};

export const CUSTOMER_EXTRA_FILTERS: ExtraFilterDef[] = [
  { key: "city", label: "Cidade", kind: "text", placeholder: "Contém…" },
  { key: "state", label: "UF", kind: "text", placeholder: "Ex.: SP" },
  { key: "email", label: "E-mail", kind: "text", placeholder: "Contém…" },
  { key: "phone", label: "Telefone", kind: "text", placeholder: "Contém…" },
  {
    key: "documentType",
    label: "Tipo documento",
    kind: "select",
    options: [
      { value: "CNPJ", label: "CNPJ" },
      { value: "CPF", label: "CPF" },
    ],
  },
  {
    key: "tradeName",
    label: "Nome fantasia",
    kind: "text",
    placeholder: "Contém…",
  },
  {
    key: "legalName",
    label: "Razão social",
    kind: "text",
    placeholder: "Contém…",
  },
];

export const ORDER_EXTRA_FILTERS: ExtraFilterDef[] = [
  {
    key: "notes",
    label: "Observações",
    kind: "text",
    placeholder: "Contém no campo notes…",
  },
  {
    key: "totalMin",
    label: "Valor total mín.",
    kind: "number",
    placeholder: "0",
  },
  {
    key: "totalMax",
    label: "Valor total máx.",
    kind: "number",
    placeholder: "999999",
  },
  {
    key: "isQuote",
    label: "Somente orçamentos",
    kind: "boolean",
    options: [
      { value: "1", label: "Sim" },
      { value: "0", label: "Não (só pedidos)" },
    ],
  },
];

export const STOCK_EXTRA_FILTERS: ExtraFilterDef[] = [
  {
    key: "stockQtyMin",
    label: "Saldo mínimo",
    kind: "number",
    placeholder: "0",
  },
  {
    key: "stockQtyMax",
    label: "Saldo máximo",
    kind: "number",
    placeholder: "9999",
  },
  {
    key: "productLine",
    label: "Linha do produto",
    kind: "text",
    placeholder: "Contém…",
  },
  {
    key: "blockSaleWhenOutOfStock",
    label: "Bloqueia venda sem estoque",
    kind: "boolean",
    options: [
      { value: "1", label: "Sim" },
      { value: "0", label: "Não" },
    ],
  },
  {
    key: "hasExpiringSoon",
    label: "Com validade < 30 dias",
    kind: "boolean",
    options: [
      { value: "1", label: "Somente com alerta" },
      { value: "0", label: "Sem alerta de validade" },
    ],
  },
];

let rowSeq = 0;
function nextRowId() {
  rowSeq += 1;
  return `xf-${rowSeq}`;
}

export function appendExtraFilters(
  params: URLSearchParams,
  rows: ExtraFilterRow[],
) {
  for (const row of rows) {
    const v = row.value.trim();
    if (!row.key || !v) continue;
    params.set(`x_${row.key}`, v);
  }
}

export function AdditionalFiltersSection({
  catalog,
  rows,
  onChange,
}: {
  catalog: ExtraFilterDef[];
  rows: ExtraFilterRow[];
  onChange: (rows: ExtraFilterRow[]) => void;
}) {
  const [pick, setPick] = useState("");
  const used = useMemo(() => new Set(rows.map((r) => r.key)), [rows]);
  const available = catalog.filter((f) => !used.has(f.key));

  function addFilter(key: string) {
    if (!key || used.has(key)) return;
    const def = catalog.find((f) => f.key === key);
    if (!def) return;
    const defaultVal =
      def.kind === "boolean" || def.kind === "select"
        ? (def.options?.[0]?.value ?? "")
        : "";
    onChange([...rows, { id: nextRowId(), key, value: defaultVal }]);
    setPick("");
  }

  function updateRow(id: string, value: string) {
    onChange(rows.map((r) => (r.id === id ? { ...r, value } : r)));
  }

  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  return (
    <ReportField label="Filtros adicionais" className="sm:items-start">
      <div className="space-y-3">
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum filtro adicional informado.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const def = catalog.find((f) => f.key === row.key);
                if (!def) return null;
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-2 py-2"
                  >
                    <span className="min-w-[8rem] text-sm font-medium">
                      {def.label}
                    </span>
                    <div className="min-w-[12rem] flex-1">
                      {def.kind === "select" || def.kind === "boolean" ? (
                        <AppSelect
                          value={row.value}
                          onValueChange={(v) => updateRow(row.id, v)}
                          options={def.options ?? []}
                        />
                      ) : (
                        <Input
                          type={def.kind === "number" ? "number" : "text"}
                          value={row.value}
                          placeholder={def.placeholder}
                          onChange={(e) => updateRow(row.id, e.target.value)}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Remover filtro"
                      onClick={() => removeRow(row.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {available.length > 0 ? (
            <div className="flex min-w-[16rem] flex-1 items-center gap-2">
              <AppSelect
                value={pick}
                onValueChange={(v) => {
                  setPick(v);
                  if (v) addFilter(v);
                }}
                emptyLabel="+ Adicionar filtro"
                options={available.map((f) => ({
                  value: f.key,
                  label: f.label,
                }))}
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              Todos os filtros extras disponíveis já foram adicionados
            </span>
          )}
          {rows.length > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => onChange([])}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar extras
            </button>
          ) : null}
        </div>
      </div>
    </ReportField>
  );
}
