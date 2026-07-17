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
import { ROLE_LABELS, type Role } from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { isWebAdmin } from "../lib/staff";

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER";
  createdAt: string;
};

const CREATABLE_ROLES: { value: "ADMIN" | "MANAGER"; label: string }[] = [
  { value: "ADMIN", label: ROLE_LABELS.ADMIN },
  { value: "MANAGER", label: ROLE_LABELS.MANAGER },
];

function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function UsersPage() {
  const { user } = useAuth();
  const admin = isWebAdmin(user?.role);
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<StaffUser[]>("/admin/users"),
    enabled: admin,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MANAGER">("MANAGER");
  const [formError, setFormError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("MANAGER");
    setFormError(null);
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
      apiFetch<StaffUser>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "managers"] });
      closeSheet();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Erro ao criar usuário");
    },
  });

  const canSave = Boolean(
    name.trim() && email.trim() && password.length >= 6 && role,
  );

  if (!admin) {
    return (
      <p className="text-muted-foreground">
        A gestão de usuários é exclusiva de administradores.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie administradores e gestores da empresa. Vendedores continuam em{" "}
            <Link to="/vendedores" className="text-primary hover:underline">
              Vendedores
            </Link>
            .
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Novo usuário
        </Button>
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title="Novo usuário"
        description="Defina nome, email, senha inicial e perfil de acesso."
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={() => {
              setFormError(null);
              create.mutate();
            }}
            submitLabel="Criar usuário"
            pending={create.isPending}
            disabled={!canSave}
          />
        }
      >
        <FormGrid cols={2}>
          <FormField
            label="Nome"
            htmlFor="user-name"
            required
            className="sm:col-span-2"
          >
            <Input
              id="user-name"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </FormField>
          <FormField label="Email" htmlFor="user-email" required>
            <Input
              id="user-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </FormField>
          <FormField
            label="Senha"
            htmlFor="user-password"
            required
            hint="Mínimo 6 caracteres"
          >
            <Input
              id="user-password"
              type="password"
              placeholder="Senha inicial"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          <FormField
            label="Perfil"
            htmlFor="user-role"
            required
            className="sm:col-span-2"
          >
            <AppSelect
              id="user-role"
              value={role}
              onValueChange={(v) => {
                if (v === "ADMIN" || v === "MANAGER") setRole(v);
              }}
              options={CREATABLE_ROLES}
              placeholder="Selecione o perfil"
            />
          </FormField>
        </FormGrid>
        {formError ? (
          <p className="mt-3 text-sm text-destructive">{formError}</p>
        ) : null}
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : null}

      {!isLoading && users.length === 0 ? (
        <p className="text-muted-foreground">Nenhum administrador ou gestor.</p>
      ) : null}

      {!isLoading && users.length > 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Nome</TableHead>
                <TableHead className="px-4">Email</TableHead>
                <TableHead className="px-4">Perfil</TableHead>
                <TableHead className="px-4">Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="px-4 font-medium">{u.name}</TableCell>
                  <TableCell className="px-4">{u.email}</TableCell>
                  <TableCell className="px-4">{roleLabel(u.role)}</TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
