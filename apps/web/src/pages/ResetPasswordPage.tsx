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
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

type ResetResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!token) {
      setErr("Link inválido. Solicite um novo e-mail de redefinição.");
      return;
    }
    if (password.length < 6) {
      setErr("Senha com pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErr("As senhas não coincidem.");
      return;
    }
    setPending(true);
    try {
      await apiFetch<ResetResponse>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      nav("/login", { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Falha ao redefinir senha");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pb-10">
      <Card className="glass glow-primary w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader>
          <CommerceProWordmark iconSize={40} className="mb-2" />
          <CardTitle className="text-xl">Redefinir senha</CardTitle>
          <CardDescription>
            Escolha uma nova senha para acessar o painel PedixPro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <Button
              type="submit"
              className="w-full"
              disabled={pending || !token}
            >
              {pending ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              to="/esqueci-senha"
              className="font-medium text-primary hover:underline"
            >
              Solicitar novo link
            </Link>
            {" · "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
