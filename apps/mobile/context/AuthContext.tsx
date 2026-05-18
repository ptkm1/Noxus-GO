import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "@pedidos/shared";
import { apiFetch, clearTokens, getAccessToken, setTokens } from "../lib/api";
import { sellerMobileLoginRejectedMessage } from "../lib/seller-login-messages";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  sellerId: string | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  sellerAccessBlocked: null | { role: Role };
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSellerAccessBlocked: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sellerAccessBlocked, setSellerAccessBlocked] = useState<null | { role: Role }>(null);

  const loadMe = useCallback(async () => {
    const t = await getAccessToken();
    if (!t) {
      setUser(null);
      setSellerAccessBlocked(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<User>("/auth/me");
      if (me.role !== "SELLER") {
        await clearTokens();
        setSellerAccessBlocked({ role: me.role });
        setUser(null);
      } else {
        setSellerAccessBlocked(null);
        setUser(me);
      }
    } catch {
      await clearTokens();
      setUser(null);
      setSellerAccessBlocked(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; refreshToken: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    if (res.user.role !== "SELLER") {
      throw new Error(sellerMobileLoginRejectedMessage(res.user.role));
    }
    await setTokens(res.accessToken, res.refreshToken);
    setSellerAccessBlocked(null);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
    setSellerAccessBlocked(null);
  }, []);

  const clearSellerAccessBlocked = useCallback(() => {
    setSellerAccessBlocked(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      sellerAccessBlocked,
      login,
      logout,
      clearSellerAccessBlocked,
    }),
    [user, loading, sellerAccessBlocked, login, logout, clearSellerAccessBlocked],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
