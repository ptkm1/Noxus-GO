"use client";

import type {
    PublicIntentNextAction,
    PublicIntentStatus,
} from "@pedidos/shared";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type StatusResponse = {
  status: PublicIntentStatus;
  nextAction: PublicIntentNextAction;
  intentId: string;
  checkoutUrl?: string | null;
  error?: string;
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

const COPY: Record<PublicIntentStatus, { title: string; body: string }> = {
  PROCESSING: {
    title: "Estamos confirmando seu pagamento.",
    body: "Isso pode levar alguns segundos. Não feche esta página.",
  },
  ACTIVE: {
    title: "Pagamento confirmado. Sua conta está sendo preparada.",
    body: "Verifique seu e-mail para criar a senha de acesso ao painel.",
  },
  CANCELED: {
    title: "O pagamento foi cancelado.",
    body: "Você pode tentar novamente quando quiser.",
  },
  EXPIRED: {
    title: "Este link de pagamento expirou.",
    body: "Gere um novo checkout para continuar.",
  },
  FAILED: {
    title: "Não foi possível concluir a contratação.",
    body: "Tente novamente. Se o problema continuar, fale com o suporte.",
  },
  PENDING: {
    title: "O pagamento ainda está aguardando confirmação.",
    body: "Se você já pagou, aguarde alguns instantes.",
  },
};

function ProcessingInner() {
  const searchParams = useSearchParams();
  const intentId = searchParams.get("intentId") || "";
  const resultHint = searchParams.get("result");
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  const load = useCallback(async () => {
    if (!intentId) return;
    try {
      const res = await fetch(
        `${apiBase()}/api/v1/billing/subscription-intents/${intentId}/status`,
      );
      const json = (await res.json()) as StatusResponse;
      if (!res.ok) {
        setError(json.error || "Não foi possível consultar o status.");
        return;
      }
      setData(json);
      setError(null);
      setTries((t) => t + 1);
    } catch {
      setError("Falha de rede ao consultar o status.");
    }
  }, [intentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!intentId || !data) return;
    const terminal = ["ACTIVE", "CANCELED", "EXPIRED", "FAILED"].includes(
      data.status,
    );
    if (terminal || tries >= 40) return;
    const delay = Math.min(2000 + tries * 250, 8000);
    const t = setTimeout(() => void load(), delay);
    return () => clearTimeout(t);
  }, [data, intentId, load, tries]);

  if (!intentId) {
    return (
      <main className="processing-page">
        <h1>Contratação</h1>
        <p>Identificador de pedido ausente.</p>
        <Link href="/#planos">Voltar aos planos</Link>
      </main>
    );
  }

  const status =
    data?.status ||
    (resultHint === "canceled"
      ? "CANCELED"
      : resultHint === "expired"
        ? "EXPIRED"
        : "PROCESSING");
  const copy = COPY[status];

  return (
    <main className="processing-page">
      <p className="eyebrow">PedixPro</p>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      {error ? <p className="checkout-error">{error}</p> : null}

      {data?.nextAction === "SET_PASSWORD" || data?.status === "ACTIVE" ? (
        <p>
          <a className="btn-primary" href={`${appUrl()}/login`}>
            Ir para o login do painel
          </a>
        </p>
      ) : null}

      {(data?.nextAction === "PAY_CARD" ||
        data?.nextAction === "RETRY" ||
        data?.status === "PENDING") &&
      intentId ? (
        <p>
          <a
            className="btn-primary"
            href={`${appUrl()}/pagamento?intentId=${encodeURIComponent(intentId)}`}
          >
            Concluir pagamento
          </a>
        </p>
      ) : null}

      {(data?.nextAction === "RETRY" ||
        status === "FAILED" ||
        status === "EXPIRED" ||
        status === "CANCELED") && (
        <p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              void (async () => {
                const res = await fetch(
                  `${apiBase()}/api/v1/billing/subscription-intents/${intentId}/retry`,
                  { method: "POST" },
                );
                const json = (await res.json()) as {
                  intentId?: string;
                  error?: string;
                };
                if (json.intentId) {
                  window.location.assign(
                    `${appUrl()}/pagamento?intentId=${encodeURIComponent(json.intentId)}`,
                  );
                } else {
                  setError(json.error || "Falha ao preparar pagamento");
                }
              })();
            }}
          >
            Tentar novamente
          </button>
        </p>
      )}

      <p>
        <button type="button" className="linkish" onClick={() => void load()}>
          Atualizar status
        </button>
      </p>
      <p className="muted">Pedido: {intentId}</p>
    </main>
  );
}

export default function ProcessandoPage() {
  return (
    <Suspense
      fallback={
        <main className="processing-page">
          <h1>Confirmando pagamento…</h1>
        </main>
      }
    >
      <ProcessingInner />
    </Suspense>
  );
}
