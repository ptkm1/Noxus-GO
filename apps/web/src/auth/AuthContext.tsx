import type {
    PermissionLevel,
    PermissionResource,
    PlanFeature,
    PlanId,
    PlanLimits,
    Role,
} from "@pedidos/shared";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, clearTokens, getAccessToken, setTokens } from "../lib/api";
import {
    getErrorMessage,
    isNetworkError,
    isUnauthorizedError,
} from "../lib/api-error";
import { notifyError } from "../lib/app-notifications";

export type UserSubscription = {
  planId: PlanId;
  status: string;
  features: PlanFeature[];
  limits: PlanLimits;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  provider: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  matricula?: string | null;
  role: Role;
  organizationId: string;
  /** Nome visível da empresa (white-label / isolamento). */
  organizationName?: string | null;
  organizationProfileId?: string | null;
  preferredEstablishmentId?: string | null;
  sellerId: string | null;
  isTeamLeader?: boolean;
  teamId?: string | null;
  teamName?: string | null;
  /** Permissões efetivas da org para o role/perfil atual (`/auth/me`). */
  permissions?: Partial<Record<PermissionResource, PermissionLevel>>;
  subscription?: UserSubscription;
  accessStatus?: string;
  orgAccessMessage?: string | null;
  canUseApp?: boolean;
};

export type RegisterInput = {
  organizationName: string;
  name: string;
  email: string;
  password: string;
  cnpj: string;
  planId?: PlanId;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<{
    user: User;
    requiresPayment: boolean;
    checkoutUrl: string | null;
    intentId: string | null;
    checkoutError: string | null;
  }>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
};

/** Mesma instância no HMR do Vite — senão AppRoutes usa um Context e o Provider outro. */
const authContextKey = "__pedixAuthContext" as const;
const AuthContext = ((globalThis as Record<string, unknown>)[authContextKey] ??=
  createContext<AuthState | null>(null)) as ReturnType<
  typeof createContext<AuthState | null>
>;

function clearBrowserStorage() {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Busca /auth/me com retries curtos em falha de rede (API reiniciando / HMR). */
async function fetchMeWithRetry(): Promise<User> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await apiFetch<User>("/auth/me");
    } catch (err) {
      lastErr = err;
      if (isUnauthorizedError(err)) throw err;
      if (!isNetworkError(err) && !(err instanceof TypeError)) throw err;
      if (attempt < 2) await sleep(400 * (attempt + 1));
    }
  }
  throw lastErr;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await fetchMeWithRetry();
      setUser(me);
    } catch (err) {
      if (isUnauthorizedError(err)) {
        clearTokens();
        setUser(null);
      } else {
        // Mantém tokens: API fora / rede. Usuário pode F5 quando voltar.
        console.warn("[auth] /auth/me falhou sem limpar sessão:", err);
        if (isNetworkError(err) || err instanceof TypeError) {
          notifyError(
            "Não foi possível contactar a API. A sessão foi mantida — tente novamente em instantes.",
            "API indisponível",
          );
        } else {
          notifyError(getErrorMessage(err), "Não foi possível carregar a sessão");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!getAccessToken()) {
      setUser(null);
      return null;
    }
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
      return me;
    } catch (err) {
      if (isUnauthorizedError(err)) {
        clearTokens();
        setUser(null);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    const onRefresh = () => {
      void refreshUser();
    };
    window.addEventListener("pedidos:auth-refresh", onRefresh);
    return () => window.removeEventListener("pedidos:auth-refresh", onRefresh);
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    queryClient.clear();
    const res = await apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return res.user;
  }, [queryClient]);

  const register = useCallback(async (input: RegisterInput) => {
    queryClient.clear();
    const res = await apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: User;
      requiresPayment?: boolean;
      intentId?: string | null;
      checkoutUrl?: string | null;
      checkoutError?: string | null;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
      skipAuth: true,
    });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return {
      user: res.user,
      requiresPayment: Boolean(res.requiresPayment),
      intentId: res.intentId ?? null,
      checkoutUrl: res.checkoutUrl ?? null,
      checkoutError: res.checkoutError ?? null,
    };
  }, [queryClient]);

  const logout = useCallback(() => {
    clearTokens();
    clearBrowserStorage();
    queryClient.clear();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
