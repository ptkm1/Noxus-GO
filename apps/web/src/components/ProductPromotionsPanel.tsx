import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
    mutationFn: (promotionId: string) =>
      apiFetch(`/admin/products/${productId}/promotions/${promotionId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "product-promotions", productId] });
    },
    onError: (e: Error) => setHint(e.message),
  });

  const patchActive = useMutation({
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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Promoções e descontos</h2>
      <p className="mt-2 text-sm text-slate-600">
        O preço usado na venda parte sempre do{" "}
        <strong className="font-medium text-slate-800">catálogo</strong> (tabela de preços ou preço base). Uma{" "}
        <strong className="font-medium text-slate-800">promoção</strong> só altera esse valor na hora da venda.
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-500">
        <li>
          <strong className="text-slate-700">Desconto %</strong>: reduz o preço de catálogo em uma percentagem.
        </li>
        <li>
          <strong className="text-slate-700">Desconto fixo (R$)</strong>: subtrai um valor por unidade do catálogo.
        </li>
        <li>
          <strong className="text-slate-700">Preço fixo / oferta</strong>: substitui o catálogo por um preço promocional por unidade (é o formato típico de “oferta”).
        </li>
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Escopo mais específico vence: <strong>cliente</strong> &gt; <strong>vendedor</strong> &gt;{" "}
        <strong>todos</strong>. Em empate, usa-se o maior <code className="rounded bg-slate-100 px-1">prioridade</code>.
      </p>

      {hint ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{hint}</p> : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Regras ativas neste produto
        </h3>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Carregando…</p>
        ) : promotions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nenhuma promoção cadastrada.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
            {promotions.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                        p.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.active ? "Ativa" : "Inativa"}
                    </span>
                    <span className="text-xs font-medium text-brand-700">{scopeLabel(p.scope)}</span>
                    <span className="text-xs text-slate-500">{kindLabel(p.kind)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {formatValue(p.kind, p.value)}
                    {p.label ? (
                      <span className="font-normal text-slate-600"> — {p.label}</span>
                    ) : null}
                  </p>
                  {p.scope === "SELLER" && p.seller ? (
                    <p className="text-xs text-slate-500">Vendedor: {p.seller.name}</p>
                  ) : null}
                  {p.scope === "CUSTOMER" && p.customer ? (
                    <p className="text-xs text-slate-500">Cliente: {p.customer.name}</p>
                  ) : null}
                  {(p.validFrom || p.validTo) && (
                    <p className="text-[11px] text-slate-400">
                      Vigência: {p.validFrom ? new Date(p.validFrom).toLocaleString("pt-BR") : "…"} →{" "}
                      {p.validTo ? new Date(p.validTo).toLocaleString("pt-BR") : "…"}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">Prioridade {p.priority}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => patchActive.mutate({ id: p.id, active: !p.active })}
                    disabled={patchActive.isPending}
                  >
                    {p.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
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

      <form onSubmit={(e) => void submitNew(e)} className="mt-8 space-y-4 border-t border-slate-100 pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nova promoção</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">Escopo</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              value={scope}
              onChange={(e) => setScope(e.target.value as PromotionDto["scope"])}
            >
              <option value="PRODUCT_GLOBAL">Todos (produto em geral)</option>
              <option value="SELLER">Só um vendedor</option>
              <option value="CUSTOMER">Só um cliente</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">Tipo</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              value={kind}
              onChange={(e) => setKind(e.target.value as PromotionDto["kind"])}
            >
              <option value="PERCENT_OFF">Desconto percentual</option>
              <option value="FIXED_AMOUNT_OFF">Desconto em R$ por unidade</option>
              <option value="SALE_PRICE">Preço fixo (oferta)</option>
            </select>
          </div>
        </div>

        {scope === "SELLER" ? (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">Vendedor</label>
            <select
              className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
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
          </div>
        ) : null}

        {scope === "CUSTOMER" ? (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">Cliente</label>
            <select
              className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
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
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Valor{" "}
              {kind === "PERCENT_OFF"
                ? "(0–100)"
                : kind === "FIXED_AMOUNT_OFF"
                  ? "(R$)"
                  : "(R$ final)"}
            </label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              required
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">Rótulo (opcional)</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="Ex.: Carnaval 2026"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">Prioridade</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">Início (opcional)</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              value={validFromLocal}
              onChange={(e) => setValidFromLocal(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">Fim (opcional)</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              value={validToLocal}
              onChange={(e) => setValidToLocal(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {create.isPending ? "Salvando…" : "Adicionar promoção"}
        </button>
      </form>
    </section>
  );
}
