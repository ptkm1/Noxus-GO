import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  user: { id: string; email: string; name: string; matricula?: string | null };
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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [commissionType, setCommissionType] =
    useState<SellerCommissionType>("FIXED");
  const [commission, setCommission] = useState("10");

  function resetForm() {
    setEmail("");
    setPassword("");
    setName("");
    setMatricula("");
    setCommissionType("FIXED");
    setCommission("10");
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/admin/sellers", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name,
          ...(matricula.trim() ? { matricula: matricula.trim() } : {}),
          commissionType,
          ...(commissionType === "FIXED"
            ? { commissionPercent: Number(commission) }
            : {}),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] });
      closeSheet();
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

  const canSave = Boolean(email && password && name);

  if (!admin) {
    return (
      <p className="text-muted-foreground">
        A gestão de vendedores é exclusiva de administradores.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Vendedores</h1>
        <Button type="button" onClick={openCreate}>
          Novo vendedor
        </Button>
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title="Novo vendedor"
        description="O admin define email e senha inicial (sem cadastro público)."
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={() => create.mutate()}
            submitLabel="Criar vendedor"
            pending={create.isPending}
            disabled={!canSave}
          />
        }
      >
        <FormGrid cols={2}>
          <FormField
            label="Nome"
            htmlFor="seller-name"
            required
            className="sm:col-span-2"
          >
            <Input
              id="seller-name"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Matrícula" htmlFor="seller-matricula">
            <Input
              id="seller-matricula"
              placeholder="Opcional"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
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
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Nome</TableHead>
                <TableHead className="px-4">Matrícula</TableHead>
                <TableHead className="px-4">Email</TableHead>
                <TableHead className="px-4">Gestor</TableHead>
                <TableHead className="px-4">Equipe</TableHead>
                <TableHead className="px-4">Tipo comissão</TableHead>
                <TableHead className="px-4">Comissão %</TableHead>
                <TableHead className="px-4">Ativo</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((s) => {
                const type = s.commissionType ?? "FIXED";
                return (
                  <TableRow key={s.id}>
                    <TableCell className="px-4 py-3">{s.user.name}</TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {s.user.matricula ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3">{s.user.email}</TableCell>
                    <TableCell className="px-4 py-3">
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
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {s.team?.name ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <AppSelect
                        value={type}
                        triggerClassName="max-w-[200px] text-xs"
                        options={[
                          ...SELLER_COMMISSION_TYPES.filter(
                            (t) => !t.comingSoon,
                          ).map((t) => ({
                            value: t.value,
                            label: t.label,
                          })),
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
                    </TableCell>
                    <TableCell className="px-4 py-3">
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
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <input
                        type="checkbox"
                        defaultChecked={s.active}
                        onChange={(e) =>
                          patch.mutate({ id: s.id, active: e.target.checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Link
                        to={`/vendedores/${s.id}/produtos`}
                        className="text-primary hover:underline"
                      >
                        Liberar produtos
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
