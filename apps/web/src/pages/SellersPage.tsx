import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Seller = {
  id: string;
  commissionPercent: unknown;
  active: boolean;
  user: { id: string; email: string; name: string };
};

export function SellersPage() {
  const qc = useQueryClient();
  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("10");

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/admin/sellers", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name,
          commissionPercent: Number(commission),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] });
      setEmail("");
      setPassword("");
      setName("");
    },
  });

  const patch = useMutation({
    mutationFn: ({ id, commissionPercent, active }: { id: string; commissionPercent?: number; active?: boolean }) =>
      apiFetch(`/admin/sellers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ commissionPercent, active }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "sellers"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Vendedores</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Novo vendedor</h2>
        <p className="mt-1 text-xs text-slate-500">O admin define email e senha inicial (sem cadastro público).</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Senha (mín. 6)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Comissão %"
            type="number"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="mt-3 rounded bg-brand-600 px-4 py-2 text-sm text-white"
          disabled={!email || !password || !name || create.isPending}
          onClick={() => create.mutate()}
        >
          Criar vendedor
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Comissão %</th>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{s.user.name}</td>
                  <td className="px-4 py-3">{s.user.email}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      className="w-20 rounded border px-2 py-1"
                      defaultValue={Number(s.commissionPercent)}
                      key={`${s.id}-${s.commissionPercent}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v !== Number(s.commissionPercent)) {
                          patch.mutate({ id: s.id, commissionPercent: v });
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      defaultChecked={s.active}
                      onChange={(e) => patch.mutate({ id: s.id, active: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/vendedores/${s.id}/produtos`}
                      className="text-brand-600 hover:underline"
                    >
                      Liberar produtos
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
