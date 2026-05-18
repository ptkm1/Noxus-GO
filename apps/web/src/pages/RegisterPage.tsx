import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CnpjCompanyData } from "@pedidos/shared";
import { suggestedTradeName } from "@pedidos/shared";
import { useAuth } from "../auth/AuthContext";
import { CnpjLookupField } from "../components/CnpjLookupField";

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
    <div className="flex flex-1 flex-col items-center justify-center p-4 pb-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Criar conta</h1>
        <p className="mt-1 text-sm text-slate-500">Nova empresa e administrador</p>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <CnpjLookupField
            disabled={pending}
            onApply={(d: CnpjCompanyData) => {
              setOrganizationName(suggestedTradeName(d));
            }}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome da empresa</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              autoComplete="organization"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">O teu nome</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Senha</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
            <p className="mt-1 text-xs text-slate-500">Mínimo 6 caracteres</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirmar senha</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "A criar conta…" : "Criar conta"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Já tens conta?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
