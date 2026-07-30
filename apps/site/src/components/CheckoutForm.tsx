"use client";

import {
  isPlanId,
  listPlans,
  PLAN_FEATURE_LABELS,
  type PlanId,
} from "@pedidos/shared";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type RegisterResponse = {
  user?: { organizationId?: string };
  error?: string;
  details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
};

type CheckoutResponse = {
  intentId: string;
  message: string;
  error?: string;
};

const MIN_PASSWORD = 6;

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function appLoginUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:5173";
  return `${base}/login`;
}

function apiErrorMessage(
  data: { error?: string; details?: RegisterResponse["details"] },
  fallback: string,
): string {
  if (data.error && data.error !== "Dados inválidos") return data.error;
  const fieldErrors = data.details?.fieldErrors;
  if (fieldErrors) {
    const first = Object.values(fieldErrors).flat()[0];
    if (first) return first;
  }
  const formError = data.details?.formErrors?.[0];
  if (formError) return formError;
  return data.error || fallback;
}

export function CheckoutForm({
  initialPlanId = "growth",
}: {
  initialPlanId?: PlanId;
}) {
  const searchParams = useSearchParams();
  const plans = useMemo(() => listPlans(), []);
  const [step, setStep] = useState<1 | 2>(1);
  const [planId, setPlanId] = useState<PlanId>(initialPlanId);

  useEffect(() => {
    const fromQuery = searchParams.get("plan");
    if (fromQuery && isPlanId(fromQuery)) setPlanId(fromQuery);
  }, [searchParams]);

  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    intentId: string | null;
    message: string;
  } | null>(null);

  function goToAccess(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!companyName.trim() || !adminName.trim()) {
      setError("Preencha empresa e o seu nome.");
      return;
    }
    setStep(2);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Senha com pelo menos ${MIN_PASSWORD} caracteres`);
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const registerRes = await fetch(`${apiBase()}/api/v1/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationName: companyName.trim(),
          name: adminName.trim(),
          email: email.trim(),
          password,
          planId,
        }),
      });
      const registerData = (await registerRes.json()) as RegisterResponse;
      if (!registerRes.ok) {
        throw new Error(
          apiErrorMessage(registerData, "Não foi possível criar a conta."),
        );
      }

      const organizationId = registerData.user?.organizationId;
      let intentId: string | null = null;
      let checkoutMessage =
        "Conta criada. Em breve redirecionaremos ao pagamento online.";

      try {
        const checkoutRes = await fetch(
          `${apiBase()}/api/v1/billing/checkout-intent`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              planId,
              companyName: companyName.trim(),
              email: email.trim(),
              phone: phone.trim() || undefined,
              document: document.trim() || undefined,
              organizationId,
            }),
          },
        );
        const checkoutData = (await checkoutRes.json()) as CheckoutResponse;
        if (checkoutRes.ok) {
          intentId = checkoutData.intentId;
          checkoutMessage = checkoutData.message;
        }
      } catch {
        /* conta já criada; intent é stub opcional */
      }

      setResult({ intentId, message: checkoutMessage });
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
          Conta criada
        </h3>
        <p style={{ margin: "0 0 1rem", color: "var(--muted)" }}>
          {result.message} O redirecionamento ao pagamento online entra em uma
          próxima etapa.
        </p>
        <a href={appLoginUrl()} className="btn btn-primary">
          Entrar na plataforma
        </a>
        {result.intentId ? (
          <p
            style={{
              margin: "1rem 0 0",
              fontSize: "0.85rem",
              fontFamily: "ui-monospace, monospace",
              wordBreak: "break-all",
            }}
          >
            intentId (dev): {result.intentId}
          </p>
        ) : null}
      </div>
    );
  }

  if (step === 1) {
    return (
      <form
        onSubmit={goToAccess}
        style={{
          display: "grid",
          gap: "1rem",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1.5rem",
          background: "var(--white)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          Passo 1 de 2 — Dados da empresa
        </p>
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
          <label htmlFor="adminName">O seu nome</label>
          <input
            id="adminName"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Administrador da conta"
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
        <button type="submit" className="btn btn-primary">
          Continuar
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
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
        Passo 2 de 2 — Acesso à plataforma
      </p>
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
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
        />
      </div>
      <div className="field">
        <label htmlFor="confirmPassword">Confirmar senha</label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
        />
      </div>
      {error ? <p className="field-error">{error}</p> : null}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-outline"
          disabled={loading}
          onClick={() => {
            setError(null);
            setStep(1);
          }}
        >
          Voltar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ flex: 1 }}
        >
          {loading ? "Criando conta…" : "Criar conta"}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
        Plano {plans.find((p) => p.id === planId)?.name} · {companyName}
      </p>
    </form>
  );
}
