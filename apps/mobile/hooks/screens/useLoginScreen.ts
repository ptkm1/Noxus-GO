import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export function useLoginScreen() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("vendedor@demo.com");
  const [password, setPassword] = useState("vendedor123");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const shouldRedirectSeller = !loading && user?.role === "SELLER";

  async function onSubmit() {
    setErr(null);
    setPending(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/sales");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao entrar");
    } finally {
      setPending(false);
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    err,
    pending,
    shouldRedirectSeller,
    onSubmit,
  };
}
