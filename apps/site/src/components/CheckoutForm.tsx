"use client";

import {
  isPlanId,
  listPlans,
  PLAN_FEATURE_LABELS,
  type PlanId,
} from "@pedidos/shared";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type CheckoutResponse = {
  intentId: string;
  message: string;
};

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function CheckoutForm({
  initialPlanId = "growth",
}: {
  initialPlanId?: PlanId;
}) {
  const searchParams = useSearchParams();
  const plans = useMemo(() => listPlans(), []);
  const [planId, setPlanId] = useState<PlanId>(initialPlanId);

  useEffect(() => {
    const fromQuery = searchParams.get("plan");
    if (fromQuery && isPlanId(fromQuery)) setPlanId(fromQuery);
  }, [searchParams]);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResponse | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/v1/billing/checkout-intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId,
          companyName,
          email,
          phone: phone.trim() || undefined,
          document: document.trim() || undefined,
        }),
      });
      const data = (await res.json()) as CheckoutResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível registrar o pedido.");
      }
      setResult({ intentId: data.intentId, message: data.message });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1.5rem",
          background: "var(--brand-soft)",
        }}
      >
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.15rem" }}>
          Pedido registrado
        </h3>
        <p style={{ margin: "0 0 1rem", color: "var(--muted)" }}>
          {result.message} O redirecionamento ao pagamento online entra em uma
          próxima etapa.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            fontFamily: "ui-monospace, monospace",
            wordBreak: "break-all",
          }}
        >
          intentId (dev): {result.intentId}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "grid",
        gap: "1rem",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1.5rem",
        background: "var(--white)",
      }}
    >
      <div className="field">
        <label htmlFor="planId">Plano</label>
        <select
          id="planId"
          value={planId}
          onChange={(e) => setPlanId(e.target.value as PlanId)}
          required
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — R$ {p.monthlyPriceBrl}/mês
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="companyName">Empresa</label>
        <input
          id="companyName"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          autoComplete="organization"
          placeholder="Razão social ou nome fantasia"
        />
      </div>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="voce@empresa.com"
        />
      </div>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        <div className="field">
          <label htmlFor="phone">Telefone</label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="(11) 99999-9999"
          />
        </div>
        <div className="field">
          <label htmlFor="document">CNPJ (opcional)</label>
          <input
            id="document"
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Enviando…" : "Continuar para pagamento"}
      </button>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
        Inclui, entre outros:{" "}
        {plans
          .find((p) => p.id === planId)
          ?.features.slice(0, 4)
          .map((f) => PLAN_FEATURE_LABELS[f])
          .join(" · ")}
        …
      </p>
    </form>
  );
}
