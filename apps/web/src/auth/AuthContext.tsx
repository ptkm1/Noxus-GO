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

const AuthContext = createContext<AuthState | null>(null);

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
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
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
    } catch {
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
