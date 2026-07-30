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
import { Link } from "react-router-dom";

type ForgotResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await apiFetch<ForgotResponse>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setDone(true);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Falha ao solicitar reset");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pb-10">
      <Card className="glass glow-primary w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader>
          <CommerceProWordmark iconSize={40} className="mb-2" />
          <CardTitle className="text-xl">Esqueci minha senha</CardTitle>
          <CardDescription>
            Informe o e-mail da sua conta. Se existir uma conta ativa, enviaremos
            um link para redefinir a senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se existir uma conta ativa com este e-mail, você receberá
                instruções em breve. Verifique também a pasta de spam.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              {err ? <p className="text-sm text-destructive">{err}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Enviando…" : "Enviar link"}
              </Button>
            </form>
          )}
          {!done ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Lembrou a senha?{" "}
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
                Entrar
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
