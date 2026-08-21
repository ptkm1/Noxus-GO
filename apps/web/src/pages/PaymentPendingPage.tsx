import { SubscriptionCardForm } from "@/components/billing/SubscriptionCardForm";
import { formatPlanPriceBrl, getPlanDefinition, isPlanId, planSeatPriceCaption, type PlanId } from "@pedidos/shared";
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
  amountBrl?: number;
  fakeGateway?: boolean;
  changeType?: "plan_change" | "initial" | null;
  previousPlanId?: string | null;
  billingDefaults?: {
    email?: string;
    holderName?: string;
    holderFullName?: string;
    cpfCnpj?: string;
    mobilePhone?: string;
  };
};

function localAppOrigin(): string {
  const env = import.meta.env.VITE_WEB_APP_URL as string | undefined;
  if (env?.trim()) return env.trim().replace(/\/$/, "");
  return "http://localhost:5173";
}

function loginRedirectPath(intentId: string): string {
  return `/login?redirect=${encodeURIComponent(
    intentId
      ? `/pagamento?intentId=${encodeURIComponent(intentId)}&change=plan`
      : "/pagamento",
  )}`;
}

export function PaymentPendingPage() {
  const { user, refreshUser, logout } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const enteringRef = useRef(false);
  const openCheckedRef = useRef(false);
  const paymentStartedRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const changeFlowRef = useRef(params.get("change") === "plan");
  const changeTypeRef = useRef<IntentStatus["changeType"]>(null);

  useEffect(() => {
    if (params.get("change") === "plan") {
      changeFlowRef.current = true;
    }
  }, [params]);

  const [intentId, setIntentId] = useState(params.get("intentId") || "");
  const [fakeGateway, setFakeGateway] = useState(false);
  const [planId, setPlanId] = useState<PlanId>(
    user?.subscription?.planId ?? "start",
  );
  const [billingDefaults, setBillingDefaults] = useState<
    IntentStatus["billingDefaults"]
  >();
  const [changeType, setChangeType] = useState<
    IntentStatus["changeType"]
  >(null);
  const [previousPlanId, setPreviousPlanId] = useState<string | null>(null);
  const [chargedAmountBrl, setChargedAmountBrl] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [entering, setEntering] = useState(
    params.get("paid") === "1" || params.get("paid") === "true",
  );

  changeTypeRef.current = changeType;
  if (changeType === "plan_change") changeFlowRef.current = true;

  const isPlanChangeFlow =
    changeFlowRef.current ||
    changeType === "plan_change" ||
    Boolean(
      user?.subscription?.planId &&
        planId &&
        user.subscription.planId !== planId,
    );

  const redirectHomeIfPendingPaid = useCallback((me?: User | null) => {
    if (changeFlowRef.current || changeTypeRef.current === "plan_change") {
      return false;
    }
    const profile = me ?? userRef.current;
    const pendingPlanChange =
      profile?.subscription?.planId &&
      planId &&
      profile.subscription.planId !== planId;
    if (pendingPlanChange) return false;
    if (profile?.accessStatus === "ACTIVE") {
      nav("/", { replace: true });
      return true;
    }
    return false;
  }, [nav, planId]);

  const finishPlanChange = useCallback(async () => {
    await refreshUser();
    nav("/configuracoes", { replace: true });
  }, [nav, refreshUser]);

  const enterAppAfterPayment = useCallback(
    async (id: string) => {
      if (enteringRef.current) return;
      enteringRef.current = true;
      setEntering(true);
      setError(null);
      try {
        if (changeTypeRef.current === "plan_change" || changeFlowRef.current) {
          await apiFetch("/auth/complete-payment", {
            method: "POST",
            body: JSON.stringify({ intentId: id }),
          });
          await finishPlanChange();
          return;
        }
        const session = await apiFetch<{
          accessToken: string;
          refreshToken: string;
          user: User;
        }>("/auth/complete-payment", {
          method: "POST",
          body: JSON.stringify({ intentId: id }),
          skipAuth: !getAccessToken(),
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
        if (changeTypeRef.current === "plan_change" || changeFlowRef.current) {
          setError(
            ex instanceof Error
              ? ex.message
              : "Não foi possível concluir a alteração de plano",
          );
          return;
        }
        if (redirectHomeIfPendingPaid(await refreshUser())) return;
        setError(
          ex instanceof Error
            ? ex.message
            : "Não foi possível entrar após o pagamento",
        );
      }
    },
    [finishPlanChange, nav, redirectHomeIfPendingPaid, refreshUser],
  );

  const applyStatusRef = useRef<(data: IntentStatus) => Promise<void>>(
    async () => {},
  );
  applyStatusRef.current = async (data: IntentStatus) => {
    setIntentId(data.intentId);
    setPlanId(isPlanId(data.planId) ? data.planId : "start");
    setFakeGateway(Boolean(data.fakeGateway));
    if (typeof data.amountBrl === "number") setChargedAmountBrl(data.amountBrl);
    if (data.billingDefaults) setBillingDefaults(data.billingDefaults);
    if (data.changeType) {
      setChangeType(data.changeType);
      if (data.changeType === "plan_change") changeFlowRef.current = true;
    }
    if (data.previousPlanId) setPreviousPlanId(data.previousPlanId);
    if (
      data.status === "ACTIVE" &&
      (data.nextAction === "ENTER_APP" || data.nextAction === "LOGIN")
    ) {
      const planChangePending =
        changeFlowRef.current ||
        changeTypeRef.current === "plan_change" ||
        data.changeType === "plan_change" ||
        Boolean(
          userRef.current?.subscription?.planId &&
            data.planId &&
            userRef.current.subscription.planId !== data.planId,
        );
      if (planChangePending && !paymentStartedRef.current) {
        return;
      }
      await enterAppAfterPayment(data.intentId);
    }
  };

  useEffect(() => {
    if (openCheckedRef.current || intentId || !getAccessToken()) return;
    openCheckedRef.current = true;

    void (async () => {
      const me = await refreshUser();
      if (redirectHomeIfPendingPaid(me)) return;
      if (me?.accessStatus !== "PENDING_PAYMENT") return;

      try {
        const open = await apiFetch<{
          intent: { id: string; planId: string } | null;
          accessStatus?: string | null;
        }>("/billing/checkout/open");

        if (open.accessStatus === "ACTIVE") {
          redirectHomeIfPendingPaid(await refreshUser());
          return;
        }
        if (open.intent) {
          setIntentId(open.intent.id);
          setPlanId(
            isPlanId(open.intent.planId) ? open.intent.planId : "start",
          );
          return;
        }

        const planIdToCharge =
          me?.subscription?.planId && isPlanId(me.subscription.planId)
            ? me.subscription.planId
            : "start";
        const created = await apiFetch<{ intentId?: string }>(
          "/billing/checkout",
          {
            method: "POST",
            body: JSON.stringify({ planId: planIdToCharge }),
          },
        );
        if (created.intentId) {
          setIntentId(created.intentId);
          setPlanId(planIdToCharge);
        } else {
          setError("Não foi possível iniciar o pagamento.");
        }
      } catch (ex) {
        setError(ex instanceof Error ? ex.message : "Falha ao carregar pagamento");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez ao montar
  }, []);

  useEffect(() => {
    if (!intentId) return;

    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<IntentStatus>(
          `/billing/subscription-intents/${intentId}/status`,
          { skipAuth: !getAccessToken() },
        );
        if (cancelled) return;
        await applyStatusRef.current(data);
      } catch (ex) {
        if (cancelled) return;
        if (ex instanceof ApiError && ex.status === 429) return;
        setError(ex instanceof Error ? ex.message : "Falha ao carregar pagamento");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [intentId]);

  useEffect(() => {
    if (!intentId || !processingPayment) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function pollStatus() {
      if (enteringRef.current || cancelled) return;
      try {
        const data = await apiFetch<IntentStatus>(
          `/billing/subscription-intents/${intentId}/status`,
          { skipAuth: !getAccessToken() },
        );
        if (cancelled) return;
        await applyStatusRef.current(data);
        if (data.status === "ACTIVE") return;
      } catch (ex) {
        if (cancelled) return;
        if (ex instanceof ApiError && ex.status === 429) return;
      }
    }

    void pollStatus();
    timer = window.setInterval(() => {
      void pollStatus();
    }, 8000);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [intentId, processingPayment]);

  async function simulate() {
    if (!intentId) return;
    setError(null);
    try {
      await apiFetch(`/billing/subscription-intents/${intentId}/simulate`, {
        method: "POST",
        skipAuth: true,
      });
      await enterAppAfterPayment(intentId);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Falha ao simular pagamento");
    }
  }

  async function handleAlreadyPaid() {
    setError(null);
    if (isPlanChangeFlow) {
      setError("Conclua o pagamento abaixo para alterar o plano.");
      return;
    }
    if (redirectHomeIfPendingPaid()) return;
    if (!user && !getAccessToken()) {
      nav(loginRedirectPath(intentId));
      return;
    }
    const me = await refreshUser();
    if (redirectHomeIfPendingPaid(me)) return;
    if (intentId) {
      await enterAppAfterPayment(intentId);
      return;
    }
    setError(
      "Pagamento ainda não confirmado. Aguarde alguns segundos ou conclua o pagamento abaixo.",
    );
  }

  async function handleCardPaid(result: { status: string; intentId: string }) {
    paymentStartedRef.current = true;
    setProcessingPayment(true);
    setError(null);
    if (result.status === "ACTIVE") {
      await enterAppAfterPayment(result.intentId);
      return;
    }
    try {
      const data = await apiFetch<IntentStatus>(
        `/billing/subscription-intents/${result.intentId}/status`,
        { skipAuth: !getAccessToken() },
      );
      await applyStatusRef.current(data);
    } catch (ex) {
      if (!(ex instanceof ApiError && ex.status === 429)) {
        setError(ex instanceof Error ? ex.message : "Falha ao consultar pagamento");
      }
    }
  }

  const plan = getPlanDefinition(String(planId));
  const previousPlan =
    previousPlanId != null ? getPlanDefinition(String(previousPlanId)) : null;
  const chargeBrl = chargedAmountBrl ?? plan.monthlyPriceBrl;
  const isPlanChange = isPlanChangeFlow && previousPlan != null;
  const showForm =
    Boolean(intentId) && !entering && !processingPayment && (isPlanChangeFlow || user?.accessStatus !== "ACTIVE");

  if (entering) {
    return (
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pb-10">
        <div className="glass glow-primary w-full max-w-md rounded-2xl border border-border/50 p-8 text-center shadow-2xl">
          <h1 className="text-xl font-semibold text-foreground">
            {isPlanChangeFlow ? "Plano atualizado" : "Pagamento confirmado"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {isPlanChangeFlow ? (
              <>Atualizando seu plano para <strong>{plan.name}</strong>…</>
            ) : (
              <>Entrando no painel com o plano <strong>{plan.name}</strong>…</>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (processingPayment) {
    return (
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pb-10">
        <div className="glass glow-primary w-full max-w-md rounded-2xl border border-border/50 p-8 text-center shadow-2xl">
          <h1 className="text-xl font-semibold text-foreground">
            Confirmando pagamento…
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Aguarde enquanto validamos a transação. Esta página atualiza sozinha.
          </p>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pb-10">
      <div className="glass glow-primary w-full max-w-md rounded-2xl border border-border/50 p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold text-foreground">
          {isPlanChangeFlow ? "Alterar plano" : "Pagamento da assinatura"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isPlanChange && previousPlan ? (
            <>
              Alterando de <strong>{previousPlan.name}</strong> (
              {planSeatPriceCaption(previousPlan)}) para{" "}
              <strong>{plan.name}</strong> ({formatPlanPriceBrl(chargeBrl)}
              /mês). Confirme o cartão para concluir.
            </>
          ) : isPlanChangeFlow ? (
            <>
              Novo plano: <strong>{plan.name}</strong> (
              {formatPlanPriceBrl(chargeBrl)}/mês). Confirme o cartão para
              concluir a alteração.
            </>
          ) : user?.orgAccessMessage ? (
            <>{user.orgAccessMessage}</>
          ) : (
            <>
              Plano <strong>{plan.name}</strong> · {planSeatPriceCaption(plan)}
            </>
          )}
        </p>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        {showForm ? (
          <div className="mt-6">
            <SubscriptionCardForm
              intentId={intentId}
              planName={plan.name}
              amountBrl={chargeBrl}
              skipAuth={!getAccessToken()}
              defaults={{
                holderName: user?.name ?? billingDefaults?.holderName,
                holderFullName: user?.name ?? billingDefaults?.holderFullName,
                email: user?.email ?? billingDefaults?.email,
                cpfCnpj: billingDefaults?.cpfCnpj,
                mobilePhone: billingDefaults?.mobilePhone,
              }}
              onPaid={handleCardPaid}
              onError={setError}
            />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          {isPlanChangeFlow ? (
            <Button type="button" variant="ghost" onClick={() => nav("/configuracoes")}>
              Voltar às configurações
            </Button>
          ) : null}
          {fakeGateway && intentId && !isPlanChangeFlow ? (
            <Button type="button" variant="outline" onClick={() => void simulate()}>
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

        {!isPlanChangeFlow ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Já pagou?{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => void handleAlreadyPaid()}
            >
              {user ? "Entrar no app" : "Entrar"}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
