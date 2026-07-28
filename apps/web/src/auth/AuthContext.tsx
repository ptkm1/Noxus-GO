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
  sellerId: string | null;
  isTeamLeader?: boolean;
  teamId?: string | null;
  teamName?: string | null;
  /** Permissões efetivas da org para o role atual (`/auth/me`). */
  permissions?: Partial<Record<PermissionResource, PermissionLevel>>;
  subscription?: UserSubscription;
};

export type RegisterInput = {
  organizationName: string;
  name: string;
  email: string;
  password: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
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

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {
      /* mantém user atual se falhar refresh pontual */
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
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
      skipAuth: true,
    });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

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
