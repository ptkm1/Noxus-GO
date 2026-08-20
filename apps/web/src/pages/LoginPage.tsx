import { useAuth } from "@/auth/AuthContext";
import { CommerceProWordmark } from "@/components/brand/CommerceProBrand";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_BRAND_TAGLINE } from "@pedidos/shared";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const loggedIn = await login(email, password);
      const redirect = params.get("redirect");
      if (redirect?.startsWith("/")) {
        nav(redirect, { replace: true });
        return;
      }
      if (loggedIn.accessStatus === "PENDING_PAYMENT") {
        nav("/pagamento", { replace: true });
        return;
      }
      nav("/", { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao entrar");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pb-10">
      <Card className="glass glow-primary w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader>
          <CommerceProWordmark iconSize={40} className="mb-2" />
          <CardTitle className="text-xl">Admin</CardTitle>
          <CardDescription>{APP_BRAND_TAGLINE}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Senha</Label>
                <Link
                  to="/esqueci-senha"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ainda não tens conta?{" "}
            <Link
              to="/cadastro"
              className="font-medium text-primary hover:underline"
            >
              Criar conta
            </Link>
          </p>
          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
            Ao acessar, você concorda com os{" "}
            <Link to="/legal/termos" className="font-medium text-primary">
              Termos de Uso
            </Link>{" "}
            e com a{" "}
            <Link
              to="/legal/privacidade"
              className="font-medium text-primary"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
