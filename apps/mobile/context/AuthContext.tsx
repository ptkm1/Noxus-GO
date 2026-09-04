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
import {
    isMobileAppRole,
    sellerMobileLoginRejectedMessage,
} from "../lib/seller-login-messages";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  sellerId: string | null;
  isTeamLeader?: boolean;
  teamId?: string | null;
  teamName?: string | null;
  accessStatus?: string;
  orgAccessMessage?: string | null;
  canUseApp?: boolean;
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

function isOrgBlocked(user: User): boolean {
  if (user.canUseApp === false) return true;
  return (
    user.accessStatus === "SUSPENDED" ||
    user.accessStatus === "CANCELED" ||
    user.accessStatus === "PENDING_PAYMENT"
  );
}

type AuthState = {
  user: User | null;
  loading: boolean;
  sellerAccessBlocked: null | { role: Role };
  orgAccessBlocked: null | { message: string };
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSellerAccessBlocked: () => void;
  clearOrgAccessBlocked: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sellerAccessBlocked, setSellerAccessBlocked] = useState<null | {
    role: Role;
  }>(null);
  const [orgAccessBlocked, setOrgAccessBlocked] = useState<null | {
    message: string;
  }>(null);

  const loadMe = useCallback(async () => {
    const t = await getAccessToken();
    if (!t) {
      setUser(null);
      setSellerAccessBlocked(null);
      setOrgAccessBlocked(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<User>("/auth/me");
      if (!isMobileAppRole(me.role)) {
        await unregisterCurrentPushDevice();
        await clearTokens();
        await clearMeSnapshot();
        setSellerAccessBlocked({ role: me.role });
        setOrgAccessBlocked(null);
        setUser(null);
      } else if (isOrgBlocked(me)) {
        await unregisterCurrentPushDevice();
        await clearTokens();
        await clearMeSnapshot();
        setOrgAccessBlocked({
          message:
            me.orgAccessMessage ||
            "O acesso desta organização está temporariamente indisponível. Entre em contato com o administrador da empresa.",
        });
        setSellerAccessBlocked(null);
        setUser(null);
      } else {
        setSellerAccessBlocked(null);
        setOrgAccessBlocked(null);
        setUser(me);
        await saveMeSnapshot(me);
      }
    } catch (e) {
      if (isNetworkError(e)) {
        const snap = await loadMeSnapshot();
        if (snap && isMobileAppRole(snap.role)) {
          setSellerAccessBlocked(null);
          setUser(snap);
        }
      } else {
        await unregisterCurrentPushDevice();
        await clearTokens();
        await clearMeSnapshot();
        setUser(null);
        setSellerAccessBlocked(null);
        setOrgAccessBlocked(null);
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
    if (!isMobileAppRole(res.user.role)) {
      throw new Error(sellerMobileLoginRejectedMessage(res.user.role));
    }
    if (isOrgBlocked(res.user)) {
      throw new Error(
        res.user.orgAccessMessage ||
          "O acesso desta organização está temporariamente indisponível. Entre em contato com o administrador da empresa.",
      );
    }
    await setTokens(res.accessToken, res.refreshToken);
    await saveMeSnapshot(res.user);
    setSellerAccessBlocked(null);
    setOrgAccessBlocked(null);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await unregisterCurrentPushDevice();
    await clearTokens();
    await clearMeSnapshot();
    setUser(null);
    setSellerAccessBlocked(null);
    setOrgAccessBlocked(null);
  }, []);

  const clearSellerAccessBlocked = useCallback(() => {
    setSellerAccessBlocked(null);
  }, []);

  const clearOrgAccessBlocked = useCallback(() => {
    setOrgAccessBlocked(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      sellerAccessBlocked,
      orgAccessBlocked,
      login,
      logout,
      clearSellerAccessBlocked,
      clearOrgAccessBlocked,
    }),
    [
      user,
      loading,
      sellerAccessBlocked,
      orgAccessBlocked,
      login,
      logout,
      clearSellerAccessBlocked,
      clearOrgAccessBlocked,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
