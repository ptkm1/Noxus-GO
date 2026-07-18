import type { Role } from "@pedidos/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { isNetworkError } from "../lib/network-error";
import { unregisterCurrentPushDevice } from "../lib/push";
import { sellerMobileLoginRejectedMessage } from "../lib/seller-login-messages";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  sellerId: string | null;
};

const ME_SNAPSHOT_KEY = "pedidos_me_snapshot";

async function saveMeSnapshot(user: User): Promise<void> {
  await AsyncStorage.setItem(ME_SNAPSHOT_KEY, JSON.stringify(user));
}

async function loadMeSnapshot(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(ME_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

async function clearMeSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(ME_SNAPSHOT_KEY);
}

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
  const [sellerAccessBlocked, setSellerAccessBlocked] = useState<null | {
    role: Role;
  }>(null);

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
        await unregisterCurrentPushDevice();
        await clearTokens();
        await clearMeSnapshot();
        setSellerAccessBlocked({ role: me.role });
        setUser(null);
      } else {
        setSellerAccessBlocked(null);
        setUser(me);
        await saveMeSnapshot(me);
      }
    } catch (e) {
      if (isNetworkError(e)) {
        const snap = await loadMeSnapshot();
        if (snap?.role === "SELLER") {
          setSellerAccessBlocked(null);
          setUser(snap);
        }
        // Mantém tokens — cold start offline não manda para login
      } else {
        await unregisterCurrentPushDevice();
        await clearTokens();
        await clearMeSnapshot();
        setUser(null);
        setSellerAccessBlocked(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

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
    if (res.user.role !== "SELLER") {
      throw new Error(sellerMobileLoginRejectedMessage(res.user.role));
    }
    await setTokens(res.accessToken, res.refreshToken);
    await saveMeSnapshot(res.user);
    setSellerAccessBlocked(null);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    // Enquanto o access token ainda vale — desassocia o device da conta
    await unregisterCurrentPushDevice();
    await clearTokens();
    await clearMeSnapshot();
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
    [
      user,
      loading,
      sellerAccessBlocked,
      login,
      logout,
      clearSellerAccessBlocked,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
