import {
  FormActions,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SELLER_COMMISSION_TYPES,
  sellerCommissionTypeLabel,
  type SellerCommissionType,
} from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { isWebAdmin } from "../lib/staff";

type Manager = { id: string; name: string; email: string };

type Seller = {
  id: string;
  commissionType: SellerCommissionType;
  commissionPercent: unknown;
  active: boolean;
  managerUserId: string | null;
  user: { id: string; email: string; name: string };
  manager: Manager | null;
  team: { id: string; name: string } | null;
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
  const [commissionType, setCommissionType] =
    useState<SellerCommissionType>("FIXED");
  const [commission, setCommission] = useState("10");

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/admin/sellers", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name,
          commissionType,
          ...(commissionType === "FIXED"
            ? { commissionPercent: Number(commission) }
            : {}),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] });
      setEmail("");
      setPassword("");
      setName("");
      setCommissionType("FIXED");
      setCommission("10");
    },
  });

  const patch = useMutation({
    mutationFn: (body: {
      id: string;
      commissionType?: SellerCommissionType;
      commissionPercent?: number;
      active?: boolean;
      managerUserId?: string | null;
    }) =>
      apiFetch(`/admin/sellers/${body.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          commissionType: body.commissionType,
          commissionPercent: body.commissionPercent,
          active: body.active,
          managerUserId: body.managerUserId,
        }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] }),
  });

  if (!admin) {
    return (
      <p className="text-muted-foreground">
        A gestão de vendedores é exclusiva de administradores.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Vendedores</h1>

      <FormSection
        title="Novo vendedor"
        description="O admin define email e senha inicial (sem cadastro público)."
      >
        <FormGrid cols={3}>
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
          <FormField
            label="Senha"
            htmlFor="seller-password"
            required
            hint="Mínimo 6 caracteres"
          >
            <Input
              id="seller-password"
              type="password"
              placeholder="Senha inicial"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormField
          label="Tipo de comissão"
          htmlFor="seller-commission-type"
          className="mt-4"
          hint="Define de onde vem o percentual nas vendas deste vendedor."
        >
          <div
            id="seller-commission-type"
            className="grid gap-2 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Tipo de comissão"
          >
            {SELLER_COMMISSION_TYPES.map((opt) => {
              const selected = commissionType === opt.value;
              const disabled = Boolean(opt.comingSoon);
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border px-3 py-3 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="commissionType"
                    className="mt-0.5"
                    value={opt.value}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => setCommissionType(opt.value)}
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      {opt.label}
                      {opt.comingSoon ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (em breve)
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {opt.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </FormField>

        {commissionType === "FIXED" ? (
          <FormField
            label="Comissão fixa (%)"
            htmlFor="seller-commission"
            className="mt-4 max-w-xs"
            hint="Percentual aplicado em todas as vendas."
          >
            <Input
              id="seller-commission"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </FormField>
        ) : commissionType === "BY_PRODUCT" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Defina o percentual de comissão em cada{" "}
            <Link to="/produtos/novo" className="text-primary hover:underline">
              produto
            </Link>
            .
          </p>
        ) : commissionType === "BY_CATEGORY" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Defina o percentual de comissão em cada{" "}
            <Link
              to="/produtos/categorias"
              className="text-primary hover:underline"
            >
              grupo de produtos (categoria)
            </Link>
            .
          </p>
        ) : null}

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
                <th className="px-4 py-3">Equipe</th>
                <th className="px-4 py-3">Tipo comissão</th>
                <th className="px-4 py-3">Comissão %</th>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => {
                const type = s.commissionType ?? "FIXED";
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3">{s.user.name}</td>
                    <td className="px-4 py-3">{s.user.email}</td>
                    <td className="px-4 py-3">
                      <AppSelect
                        value={s.managerUserId ?? ""}
                        emptyLabel="— Sem gestor —"
                        placeholder="— Sem gestor —"
                        triggerClassName="max-w-[180px]"
                        options={managers.map((m) => ({
                          value: m.id,
                          label: m.name,
                        }))}
                        onValueChange={(v) => {
                          patch.mutate({
                            id: s.id,
                            managerUserId: v === "" ? null : v,
                          });
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.team?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <AppSelect
                        value={type}
                        triggerClassName="max-w-[200px] text-xs"
                        options={[
                          ...SELLER_COMMISSION_TYPES.filter((t) => !t.comingSoon).map(
                            (t) => ({
                              value: t.value,
                              label: t.label,
                            }),
                          ),
                          {
                            value: "BY_SUPPLIER",
                            label: `${sellerCommissionTypeLabel("BY_SUPPLIER")} (em breve)`,
                            disabled: true,
                          },
                        ]}
                        onValueChange={(v) => {
                          const next = v as SellerCommissionType;
                          if (next === "BY_SUPPLIER") return;
                          patch.mutate({ id: s.id, commissionType: next });
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {type === "FIXED" ? (
                        <input
                          type="number"
                          className="w-20 rounded border px-2 py-1"
                          defaultValue={Number(s.commissionPercent)}
                          key={`${s.id}-${s.commissionPercent}-fixed`}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (
                              !Number.isNaN(v) &&
                              v !== Number(s.commissionPercent)
                            ) {
                              patch.mutate({ id: s.id, commissionPercent: v });
                            }
                          }}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        defaultChecked={s.active}
                        onChange={(e) =>
                          patch.mutate({ id: s.id, active: e.target.checked })
                        }
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
