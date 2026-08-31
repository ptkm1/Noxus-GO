"use client";

import { isPlanId, listPlans, planSeatPriceCaption, type PlanId } from "@pedidos/shared";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type IntentResponse = {
  intentId?: string;
  checkoutUrl?: string;
  message?: string;
  error?: string;
  code?: string;
};

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:4000"
  );
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:5173"
  );
}

export function CheckoutForm({
  initialPlanId = "pro",
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
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastIntentId, setLastIntentId] = useState<string | null>(null);

  async function submitIntent(retryId?: string) {
    setError(null);
    setLoading(true);
    try {
      const url = retryId
        ? `${apiBase()}/api/v1/billing/subscription-intents/${retryId}/retry`
        : `${apiBase()}/api/v1/billing/subscription-intents`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: retryId
          ? undefined
          : JSON.stringify({
              planId,
              companyName: companyName.trim(),
              adminName: adminName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim() || undefined,
              document: document.trim(),
              termsAccepted,
              privacyAccepted,
            }),
      });
      const data = (await res.json()) as IntentResponse;
      if (!res.ok) {
        if (typeof data.intentId === "string") setLastIntentId(data.intentId);
        setError(data.error || "Não foi possível preparar o pagamento.");
        return;
      }
      if (!data.intentId) {
        setError("Não foi possível iniciar o pagamento. Tente novamente.");
        return;
      }
      setLastIntentId(data.intentId);
      setRedirecting(true);
      window.location.assign(
        `${appUrl()}/pagamento?intentId=${encodeURIComponent(data.intentId)}`,
      );
    } catch {
      const base = apiBase();
      setError(
        /:3000\b/.test(base)
          ? "API na porta errada. Defina NEXT_PUBLIC_API_URL=http://localhost:4000 e reinicie o site."
          : "Falha de rede. Confira se a API está no ar (porta 4000) e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || redirecting) return;
    if (!termsAccepted || !privacyAccepted) {
      setError("Aceite os Termos de Uso e a Política de Privacidade.");
      return;
    }
    if (
      !companyName.trim() ||
      !adminName.trim() ||
      !email.trim() ||
      !document.trim()
    ) {
      setError("Preencha empresa, nome, e-mail e CPF/CNPJ.");
      return;
    }
    await submitIntent();
  }

  if (redirecting) {
    return (
      <div className="checkout-success" role="status">
        <h3>Redirecionando para o pagamento…</h3>
        <p>Você será enviado ao pagamento seguro (cartão, Pix ou boleto). Não feche esta janela.</p>
      </div>
    );
  }

  return (
    <form className="checkout-form" onSubmit={onSubmit}>
      <label htmlFor="planId">Plano</label>
      <select
        id="planId"
        value={planId}
        onChange={(e) => setPlanId(e.target.value as PlanId)}
        disabled={loading}
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {planSeatPriceCaption(p)}
          </option>
        ))}
      </select>

      <label htmlFor="companyName">Nome da empresa</label>
      <input
        id="companyName"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        required
        disabled={loading}
        autoComplete="organization"
      />

      <label htmlFor="adminName">Seu nome completo</label>
      <input
        id="adminName"
        value={adminName}
        onChange={(e) => setAdminName(e.target.value)}
        required
        disabled={loading}
        autoComplete="name"
      />

      <label htmlFor="email">E-mail do administrador</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
        autoComplete="email"
      />

      <label htmlFor="phone">Telefone</label>
      <input
        id="phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={loading}
        autoComplete="tel"
      />

      <label htmlFor="document">CPF ou CNPJ</label>
      <input
        id="document"
        value={document}
        onChange={(e) => setDocument(e.target.value)}
        required
        disabled={loading}
        inputMode="numeric"
      />

      <label className="checkout-check">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          disabled={loading}
        />
        Li e aceito os{" "}
        <Link href="/termos" target="_blank">
          Termos de Uso
        </Link>
      </label>

      <label className="checkout-check">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(e) => setPrivacyAccepted(e.target.checked)}
          disabled={loading}
        />
        Li e aceito a{" "}
        <Link href="/privacidade" target="_blank">
          Política de Privacidade
        </Link>
      </label>

      <p className="checkout-hint">
        Você definirá a senha de acesso depois da confirmação do pagamento, pelo
        e-mail que enviaremos.
      </p>

      {error ? (
        <p className="checkout-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={loading}>
        {loading ? "Preparando pagamento…" : "Continuar para pagamento"}
      </button>

      {lastIntentId && error ? (
        <button
          type="button"
          className="checkout-secondary"
          disabled={loading}
          onClick={() => void submitIntent(lastIntentId)}
        >
          Tentar novamente
        </button>
      ) : null}
    </form>
  );
}
