import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FormActions, FormField, FormGrid } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldControlClass } from "@/lib/field-styles";
import { apiFetch } from "../lib/api";

export type PromotionDto = {
  id: string;
  scope: "PRODUCT_GLOBAL" | "SELLER" | "CUSTOMER";
  kind: "PERCENT_OFF" | "FIXED_AMOUNT_OFF" | "SALE_PRICE";
  value: number;
  label: string | null;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  priority: number;
  seller: { id: string; name: string; email: string } | null;
  customer: { id: string; name: string; email: string | null } | null;
};

type SellerOpt = { id: string; user: { name: string; email: string } };
type CustomerOpt = { id: string; name: string };

function kindLabel(kind: PromotionDto["kind"]): string {
  switch (kind) {
    case "PERCENT_OFF":
      return "% no catálogo";
    case "FIXED_AMOUNT_OFF":
      return "R$ desconto / un.";
    case "SALE_PRICE":
      return "Preço fixo (oferta)";
    default:
      return kind;
  }
}

function scopeLabel(scope: PromotionDto["scope"]): string {
  switch (scope) {
    case "PRODUCT_GLOBAL":
      return "Todos";
    case "SELLER":
      return "Por vendedor";
    case "CUSTOMER":
      return "Por cliente";
    default:
      return scope;
  }
}

function formatValue(kind: PromotionDto["kind"], value: number): string {
  if (kind === "PERCENT_OFF") return `${value}%`;
  if (kind === "FIXED_AMOUNT_OFF") return `− R$ ${value.toFixed(2)}`;
  return `R$ ${value.toFixed(2)}`;
}

function localDatetimeToIso(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

type Props = { productId: string };

export function ProductPromotionsPanel({ productId }: Props) {
  const qc = useQueryClient();
  const [hint, setHint] = useState<string | null>(null);

  const [scope, setScope] = useState<PromotionDto["scope"]>("PRODUCT_GLOBAL");
  const [kind, setKind] = useState<PromotionDto["kind"]>("PERCENT_OFF");
  const [valueStr, setValueStr] = useState("10");
  const [label, setLabel] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [priority, setPriority] = useState("0");
  const [validFromLocal, setValidFromLocal] = useState("");
  const [validToLocal, setValidToLocal] = useState("");

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ["admin", "product-promotions", productId],
    queryFn: () => apiFetch<PromotionDto[]>(`/admin/products/${productId}/promotions`),
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<SellerOpt[]>("/admin/sellers"),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => apiFetch<CustomerOpt[]>("/admin/customers"),
  });

  const remove = useMutation({
    meta: { inlineError: true },
    mutationFn: (promotionId: string) =>
      apiFetch(`/admin/products/${productId}/promotions/${promotionId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "product-promotions", productId] });
    },
    onError: (e: Error) => setHint(e.message),
  });

  const patchActive = useMutation({
    meta: { inlineError: true },
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch<PromotionDto>(`/admin/products/${productId}/promotions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "product-promotions", productId] });
      setHint(null);
    },
    onError: (e: Error) => setHint(e.message),
  });

  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<PromotionDto>(`/admin/products/${productId}/promotions`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "product-promotions", productId] });
      setHint(null);
      setLabel("");
      setValueStr(kind === "PERCENT_OFF" ? "10" : kind === "FIXED_AMOUNT_OFF" ? "5" : "");
      setValidFromLocal("");
      setValidToLocal("");
    },
    onError: (e: Error) => setHint(e.message),
  });

  const sellerOptions = useMemo(
    () =>
      [...sellers].sort((a, b) =>
        (a.user?.name ?? "").localeCompare(b.user?.name ?? "", "pt"),
      ),
    [sellers],
  );

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setHint(null);
    const value = Number(valueStr.replace(",", "."));
    if (Number.isNaN(value)) {
      setHint("Valor inválido.");
      return;
    }

    const body: Record<string, unknown> = {
      scope,
      kind,
      value,
      label: label.trim() || undefined,
      priority: priority.trim() === "" ? 0 : Number.parseInt(priority, 10) || 0,
    };

    const vf = localDatetimeToIso(validFromLocal);
    const vt = localDatetimeToIso(validToLocal);
    if (vf) body.validFrom = vf;
    if (vt) body.validTo = vt;

    if (scope === "SELLER") body.sellerId = sellerId;
    if (scope === "CUSTOMER") body.customerId = customerId;

    create.mutate(body);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Promoções e descontos</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        O preço usado na venda parte sempre do{" "}
        <strong className="font-medium text-foreground">catálogo</strong> (tabela de preços ou preço base). Uma{" "}
        <strong className="font-medium text-foreground">promoção</strong> só altera esse valor na hora da venda.
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
        <li>
          <strong className="text-foreground">Desconto %</strong>: reduz o preço de catálogo em uma percentagem.
        </li>
        <li>
          <strong className="text-foreground">Desconto fixo (R$)</strong>: subtrai um valor por unidade do catálogo.
        </li>
        <li>
          <strong className="text-foreground">Preço fixo / oferta</strong>: substitui o catálogo por um preço promocional por unidade (é o formato típico de “oferta”).
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Escopo mais específico vence: <strong>cliente</strong> &gt; <strong>vendedor</strong> &gt;{" "}
        <strong>todos</strong>. Em empate, usa-se o maior <code className="rounded bg-muted px-1">prioridade</code>.
      </p>

      {hint ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">{hint}</p> : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Regras ativas neste produto
        </h3>
        {isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
        ) : promotions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma promoção cadastrada.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {promotions.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                        p.active ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.active ? "Ativa" : "Inativa"}
                    </span>
                    <span className="text-xs font-medium text-primary">{scopeLabel(p.scope)}</span>
                    <span className="text-xs text-muted-foreground">{kindLabel(p.kind)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {formatValue(p.kind, p.value)}
                    {p.label ? (
                      <span className="font-normal text-muted-foreground"> — {p.label}</span>
                    ) : null}
                  </p>
                  {p.scope === "SELLER" && p.seller ? (
                    <p className="text-xs text-muted-foreground">Vendedor: {p.seller.name}</p>
                  ) : null}
                  {p.scope === "CUSTOMER" && p.customer ? (
                    <p className="text-xs text-muted-foreground">Cliente: {p.customer.name}</p>
                  ) : null}
                  {(p.validFrom || p.validTo) && (
                    <p className="text-[11px] text-muted-foreground">
                      Vigência: {p.validFrom ? new Date(p.validFrom).toLocaleString("pt-BR") : "…"} →{" "}
                      {p.validTo ? new Date(p.validTo).toLocaleString("pt-BR") : "…"}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">Prioridade {p.priority}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background"
                    onClick={() => patchActive.mutate({ id: p.id, active: !p.active })}
                    disabled={patchActive.isPending}
                  >
                    {p.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-red-50"
                    onClick={() => {
                      if (confirm("Remover esta promoção?")) remove.mutate(p.id);
                    }}
                    disabled={remove.isPending}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={(e) => void submitNew(e)} className="mt-8 space-y-4 border-t border-border pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Nova promoção</h3>

        <FormGrid cols={2}>
          <FormField label="Escopo" htmlFor="promo-scope">
            <select
              id="promo-scope"
              className={fieldControlClass}
              value={scope}
              onChange={(e) => setScope(e.target.value as PromotionDto["scope"])}
            >
              <option value="PRODUCT_GLOBAL">Todos (produto em geral)</option>
              <option value="SELLER">Só um vendedor</option>
              <option value="CUSTOMER">Só um cliente</option>
            </select>
          </FormField>
          <FormField label="Tipo" htmlFor="promo-kind">
            <select
              id="promo-kind"
              className={fieldControlClass}
              value={kind}
              onChange={(e) => setKind(e.target.value as PromotionDto["kind"])}
            >
              <option value="PERCENT_OFF">Desconto percentual</option>
              <option value="FIXED_AMOUNT_OFF">Desconto em R$ por unidade</option>
              <option value="SALE_PRICE">Preço fixo (oferta)</option>
            </select>
          </FormField>

          {scope === "SELLER" ? (
            <FormField label="Vendedor" htmlFor="promo-seller" className="sm:col-span-2">
              <select
                id="promo-seller"
                className={fieldControlClass}
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {sellerOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user?.name ?? s.id} ({s.user?.email})
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}

          {scope === "CUSTOMER" ? (
            <FormField label="Cliente" htmlFor="promo-customer" className="sm:col-span-2">
              <select
                id="promo-customer"
                className={fieldControlClass}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}

          <FormField
            label={`Valor ${kind === "PERCENT_OFF" ? "(0–100)" : kind === "FIXED_AMOUNT_OFF" ? "(R$)" : "(R$ final)"}`}
            htmlFor="promo-value"
            required
          >
            <Input
              id="promo-value"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              required
              inputMode="decimal"
            />
          </FormField>
          <FormField label="Rótulo (opcional)" htmlFor="promo-label">
            <Input
              id="promo-label"
              placeholder="Ex.: Carnaval 2026"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </FormField>
          <FormField label="Prioridade" htmlFor="promo-priority">
            <Input
              id="promo-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              inputMode="numeric"
            />
          </FormField>
          <FormField label="Início (opcional)" htmlFor="promo-from">
            <Input
              id="promo-from"
              type="datetime-local"
              value={validFromLocal}
              onChange={(e) => setValidFromLocal(e.target.value)}
            />
          </FormField>
          <FormField label="Fim (opcional)" htmlFor="promo-to">
            <Input
              id="promo-to"
              type="datetime-local"
              value={validToLocal}
              onChange={(e) => setValidToLocal(e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormActions className="border-t-0 pt-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Salvando…" : "Adicionar promoção"}
          </Button>
        </FormActions>
      </form>
    </section>
  );
}
