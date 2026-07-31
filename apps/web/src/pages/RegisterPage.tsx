import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CnpjCompanyData } from "@pedidos/shared";
import { suggestedTradeName } from "@pedidos/shared";
import { useAuth } from "../auth/AuthContext";
import { CnpjLookupField } from "../components/CnpjLookupField";
import { FormField, FormGrid } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirmPassword) {
      setErr("As senhas não coincidem");
      return;
    }
    setPending(true);
    try {
      await register({ organizationName, name, email, password });
      nav("/", { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao cadastrar");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pb-10">
      <div className="glass glow-primary w-full max-w-md rounded-2xl border border-border/50 p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold text-foreground">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Nova empresa e administrador</p>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <CnpjLookupField
            disabled={pending}
            onApply={(d: CnpjCompanyData) => {
              setOrganizationName(suggestedTradeName(d));
            }}
          />
          <FormGrid cols={1} className="gap-4">
            <FormField label="Nome da empresa" htmlFor="reg-org" required>
              <Input
                id="reg-org"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                autoComplete="organization"
                required
              />
            </FormField>
            <FormField label="O teu nome" htmlFor="reg-name" required>
              <Input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </FormField>
            <FormField label="Email" htmlFor="reg-email" required>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </FormField>
            <FormField label="Senha" htmlFor="reg-password" required hint="Mínimo 6 caracteres">
              <Input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </FormField>
            <FormField label="Confirmar senha" htmlFor="reg-confirm" required>
              <Input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </FormField>
          </FormGrid>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "A criar conta…" : "Criar conta"}
          </Button>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Ao criar a conta, você declara que leu e aceitou os{" "}
            <Link to="/legal/termos" className="font-medium text-primary">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link
              to="/legal/privacidade"
              className="font-medium text-primary"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tens conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:text-primary">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
