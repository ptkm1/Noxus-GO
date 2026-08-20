import { getPlanDefinition } from "@pedidos/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type User } from "../auth/AuthContext";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-error";
import { apiFetch, getAccessToken, setTokens } from "@/lib/api";

type IntentStatus = {
  status: string;
  nextAction: string;
  intentId: string;
  planId: string;
  fakeGateway?: boolean;
  checkoutUrl?: string | null;
};

function localAppOrigin(): string {
  const env = import.meta.env.VITE_WEB_APP_URL as string | undefined;
  if (env?.trim()) return env.trim().replace(/\/$/, "");
  return "http://localhost:5173";
}

function isAsaasCheckoutUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "asaas.com" || u.hostname.endsWith(".asaas.com");
  } catch {
    return false;
  }
}

function loginRedirectPath(intentId: string): string {
  return `/login?redirect=${encodeURIComponent(
    intentId
      ? `/pagamento?intentId=${encodeURIComponent(intentId)}`
      : "/pagamento",
  )}`;
}

export function PaymentPendingPage() {
  const { user, refreshUser, logout } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const enteringRef = useRef(false);
  const openCheckedRef = useRef(false);
  const [intentId, setIntentId] = useState(params.get("intentId") || "");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [fakeGateway, setFakeGateway] = useState(false);
  const [planId, setPlanId] = useState(
    user?.subscription?.planId ?? "starter",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [entering, setEntering] = useState(
    params.get("paid") === "1" || params.get("paid") === "true",
  );

  const redirectHomeIfActive = useCallback(
    (me?: User | null) => {
      const profile = me ?? user;
      if (profile?.accessStatus === "ACTIVE") {
        nav("/", { replace: true });
        return true;
      }
      return false;
    },
    [nav, user],
  );

  const enterAppAfterPayment = useCallback(
    async (id: string) => {
      if (enteringRef.current) return;
      enteringRef.current = true;
      setEntering(true);
      setError(null);
      try {
        const session = await apiFetch<{
          accessToken: string;
          refreshToken: string;
          user: User;
        }>("/auth/complete-payment", {
          method: "POST",
          body: JSON.stringify({ intentId: id }),
          skipAuth: true,
        });
        setTokens(session.accessToken, session.refreshToken);
        const local = localAppOrigin();
        if (window.location.origin !== local) {
          window.location.assign(
            `${local}/pagamento?intentId=${encodeURIComponent(id)}&paid=1`,
          );
          return;
        }
        await refreshUser();
        nav("/", { replace: true });
      } catch (ex) {
        enteringRef.current = false;
        setEntering(false);
        if (redirectHomeIfActive(await refreshUser())) return;
        setError(
          ex instanceof Error
            ? ex.message
            : "Não foi possível entrar após o pagamento",
        );
      }
    },
    [nav, redirectHomeIfActive, refreshUser],
  );

  const applyStatus = useCallback(
    async (data: IntentStatus) => {
      setIntentId(data.intentId);
      setPlanId(data.planId);
      setFakeGateway(Boolean(data.fakeGateway));
      if (data.checkoutUrl) setCheckoutUrl(data.checkoutUrl);
      if (
        data.status === "ACTIVE" &&
        (data.nextAction === "ENTER_APP" || data.nextAction === "LOGIN")
      ) {
        await enterAppAfterPayment(data.intentId);
      }
    },
    [enterAppAfterPayment],
  );

  useEffect(() => {
    if (openCheckedRef.current || intentId || !getAccessToken()) return;
    openCheckedRef.current = true;

    void (async () => {
      const me = await refreshUser();
      if (redirectHomeIfActive(me)) return;
      if (me?.accessStatus !== "PENDING_PAYMENT") return;

      try {
        const open = await apiFetch<{
          intent: {
            id: string;
            status: string;
            checkoutUrl: string | null;
            planId: string;
          } | null;
          accessStatus?: string | null;
        }>("/billing/checkout/open");

        if (open.accessStatus === "ACTIVE") {
          redirectHomeIfActive(await refreshUser());
          return;
        }

        if (open.intent) {
          setIntentId(open.intent.id);
          setCheckoutUrl(open.intent.checkoutUrl);
          setPlanId(open.intent.planId);
          return;
        }

        const fresh = await refreshUser();
        redirectHomeIfActive(fresh);
      } catch (ex) {
        setError(ex instanceof Error ? ex.message : "Falha ao carregar pagamento");
      }
    })();
  }, [intentId, redirectHomeIfActive, refreshUser]);

  useEffect(() => {
    if (!intentId) return;

    let cancelled = false;

    async function pollStatus() {
      if (enteringRef.current || cancelled) return;
      if (redirectHomeIfActive(await refreshUser())) return;

      try {
        const data = await apiFetch<IntentStatus>(
          `/billing/subscription-intents/${intentId}/status`,
          { skipAuth: true },
        );
        if (!cancelled) await applyStatus(data);
      } catch (ex) {
        if (cancelled) return;
        if (ex instanceof ApiError && ex.status === 429) return;
        if (redirectHomeIfActive(await refreshUser())) return;
        setError(ex instanceof Error ? ex.message : "Falha ao carregar pagamento");
      }
    }

    void pollStatus();
    const timer = window.setInterval(() => {
      void pollStatus();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyStatus, intentId, redirectHomeIfActive]);

  async function openCheckout() {
    setError(null);
    setPending(true);
    try {
      if (intentId) {
        const data = await apiFetch<{ checkoutUrl?: string; intentId?: string }>(
          `/billing/subscription-intents/${intentId}/retry`,
          { method: "POST", skipAuth: true },
        );
        if (data.checkoutUrl && isAsaasCheckoutUrl(data.checkoutUrl)) {
          window.location.assign(data.checkoutUrl);
          return;
        }
        if (data.checkoutUrl) setCheckoutUrl(data.checkoutUrl);
        if (data.intentId) setIntentId(data.intentId);
        return;
      }
      const data = await apiFetch<{ checkoutUrl?: string; intentId?: string }>(
        "/billing/checkout",
        {
          method: "POST",
          body: JSON.stringify({ planId }),
        },
      );
      if (data.intentId) setIntentId(data.intentId);
      if (data.checkoutUrl && isAsaasCheckoutUrl(data.checkoutUrl)) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      if (data.checkoutUrl) setCheckoutUrl(data.checkoutUrl);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Não foi possível abrir o checkout");
    } finally {
      setPending(false);
    }
  }

  async function simulate() {
    if (!intentId) return;
    setError(null);
    setPending(true);
    try {
      await apiFetch(`/billing/subscription-intents/${intentId}/simulate`, {
        method: "POST",
        skipAuth: true,
      });
      await enterAppAfterPayment(intentId);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Falha ao simular pagamento");
    } finally {
      setPending(false);
    }
  }

  async function handleAlreadyPaid() {
    setError(null);
    if (redirectHomeIfActive()) return;
    if (!user && !getAccessToken()) {
      nav(loginRedirectPath(intentId));
      return;
    }
    const me = await refreshUser();
    if (redirectHomeIfActive(me)) return;
    if (intentId) {
      await enterAppAfterPayment(intentId);
      return;
    }
    setError(
      "Pagamento ainda não confirmado. Aguarde alguns segundos ou conclua o checkout.",
    );
  }

  const plan = getPlanDefinition(String(planId));
  const alreadyPaid = user?.accessStatus === "ACTIVE";

  if (entering) {
    return (
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pb-10">
        <div className="glass glow-primary w-full max-w-md rounded-2xl border border-border/50 p-8 text-center shadow-2xl">
          <h1 className="text-xl font-semibold text-foreground">
            Pagamento confirmado
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Entrando no painel com o plano <strong>{plan.name}</strong>…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pb-10">
      <div className="glass glow-primary w-full max-w-md rounded-2xl border border-border/50 p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold text-foreground">
          {alreadyPaid ? "Assinatura ativa" : "Conclua o pagamento"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {alreadyPaid ? (
            <>
              Sua assinatura do plano <strong>{plan.name}</strong> já está
              ativa. Você pode ir direto ao painel.
            </>
          ) : (
            <>
              Sua conta foi criada. O acesso ao painel libera após a confirmação
              da assinatura do plano <strong>{plan.name}</strong> (R${" "}
              {plan.monthlyPriceBrl}/mês).
            </>
          )}
        </p>
        {!alreadyPaid ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Pague com cartão no checkout seguro. Esta página atualiza sozinha
            quando o pagamento for confirmado.
          </p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        <div className="mt-6 flex flex-col gap-2">
          {alreadyPaid ? (
            <Button type="button" onClick={() => nav("/", { replace: true })}>
              Ir ao painel
            </Button>
          ) : (
            <Button type="button" disabled={pending} onClick={() => void openCheckout()}>
              {pending ? "Abrindo…" : "Ir para o pagamento"}
            </Button>
          )}
          {fakeGateway && !alreadyPaid ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending || !intentId}
              onClick={() => void simulate()}
            >
              Simular pagamento (dev)
            </Button>
          ) : null}
          {user ? (
            <Button type="button" variant="ghost" onClick={() => logout()}>
              Sair
            </Button>
          ) : (
            <Button type="button" variant="ghost" asChild>
              <Link to={loginRedirectPath(intentId)}>Entrar com outra conta</Link>
            </Button>
          )}
        </div>
        {checkoutUrl && !isAsaasCheckoutUrl(checkoutUrl) && !alreadyPaid ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Gateway de desenvolvimento ativo. Use “Simular pagamento” para
            liberar o acesso sem Asaas.
          </p>
        ) : null}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Já pagou?{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => void handleAlreadyPaid()}
          >
            {user ? (alreadyPaid ? "Ir ao painel" : "Entrar no app") : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}
