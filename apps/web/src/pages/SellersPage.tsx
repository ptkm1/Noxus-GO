import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { FormActions, FormField, FormGrid, FormSection } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "../lib/api";
import { isWebAdmin } from "../lib/staff";

type Manager = { id: string; name: string; email: string };

type Seller = {
  id: string;
  commissionPercent: unknown;
  active: boolean;
  managerUserId: string | null;
  user: { id: string; email: string; name: string };
  manager: Manager | null;
};

export function SellersPage() {
  const { user } = useAuth();
  const admin = isWebAdmin(user?.role);
  const qc = useQueryClient();

  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
    enabled: admin,
  });

  const { data: managers = [] } = useQuery({
    queryKey: ["admin", "managers"],
    queryFn: () => apiFetch<Manager[]>("/admin/managers"),
    enabled: admin,
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
    mutationFn: (body: {
      id: string;
      commissionPercent?: number;
      active?: boolean;
      managerUserId?: string | null;
    }) =>
      apiFetch(`/admin/sellers/${body.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          commissionPercent: body.commissionPercent,
          active: body.active,
          managerUserId: body.managerUserId,
        }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "sellers"] }),
  });

  if (!admin) {
    return (
      <p className="text-muted-foreground">A gestão de vendedores é exclusiva de administradores.</p>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Vendedores</h1>

      <FormSection
        title="Novo vendedor"
        description="O admin define email e senha inicial (sem cadastro público)."
      >
        <FormGrid cols={4}>
          <FormField label="Nome" htmlFor="seller-name" required>
            <Input
              id="seller-name"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Email" htmlFor="seller-email" required>
            <Input
              id="seller-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Senha" htmlFor="seller-password" required hint="Mínimo 6 caracteres">
            <Input
              id="seller-password"
              type="password"
              placeholder="Senha inicial"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField label="Comissão %" htmlFor="seller-commission">
            <Input
              id="seller-commission"
              type="number"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </FormField>
        </FormGrid>
        <FormActions>
          <Button
            type="button"
            disabled={!email || !password || !name || create.isPending}
            onClick={() => create.mutate()}
          >
            Criar vendedor
          </Button>
        </FormActions>
      </FormSection>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Gestor</th>
                <th className="px-4 py-3">Comissão %</th>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3">{s.user.name}</td>
                  <td className="px-4 py-3">{s.user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="max-w-[180px] rounded border px-2 py-1 text-sm"
                      value={s.managerUserId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        patch.mutate({
                          id: s.id,
                          managerUserId: v === "" ? null : v,
                        });
                      }}
                    >
                      <option value="">— Sem gestor —</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
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
                      className="text-primary hover:underline"
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
