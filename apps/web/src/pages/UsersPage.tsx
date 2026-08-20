import { useConfirm } from "@/components/confirm";
import {
  FormErrorBanner,
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useScrollToFirstError } from "@/hooks/useScrollToFirstError";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { isWebAdmin } from "../lib/staff";

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER";
  organizationProfileId?: string | null;
  organizationProfile?: {
    id: string;
    name: string;
    key: string;
    baseRole: string;
  } | null;
  createdAt: string;
  activatedAt?: string | null;
  invited?: boolean;
  inviteEmailSent?: boolean;
  inviteEmailError?: string;
};

type CustomProfile = {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  baseRole: Role;
  hasSellerProfile: boolean;
};

const CREATABLE_ROLES: { value: "ADMIN" | "MANAGER"; label: string }[] = [
  { value: "ADMIN", label: ROLE_LABELS.ADMIN },
  { value: "MANAGER", label: ROLE_LABELS.MANAGER },
];

function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

function staffProfileLabel(u: StaffUser): string {
  if (u.organizationProfile?.name) return u.organizationProfile.name;
  return roleLabel(u.role);
}

function profileSelectValue(
  role: "ADMIN" | "MANAGER",
  organizationProfileId: string | null,
): string {
  if (organizationProfileId) return `profile:${organizationProfileId}`;
  return role;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function selectAllState(
  allSelected: boolean,
  someSelected: boolean,
): boolean | "indeterminate" {
  if (allSelected) return true;
  if (someSelected) return "indeterminate";
  return false;
}

export function UsersPage() {
  const { user } = useAuth();
  const admin = isWebAdmin(user?.role);
  const qc = useQueryClient();
  const { confirm } = useConfirm();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<StaffUser[]>("/admin/users"),
    enabled: admin,
  });

  const { data: customProfiles = [] } = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: () => apiFetch<CustomProfile[]>("/admin/profiles"),
    enabled: admin,
  });

  const staffCustomProfiles = useMemo(
    () => customProfiles.filter((p) => p.enabled),
    [customProfiles],
  );

  const profileOptions = useMemo(
    () => [
      ...CREATABLE_ROLES,
      ...staffCustomProfiles.map((p) => ({
        value: `profile:${p.id}`,
        label: p.name,
      })),
    ],
    [staffCustomProfiles],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [role, setRole] = useState<"ADMIN" | "MANAGER">("MANAGER");
  const [organizationProfileId, setOrganizationProfileId] = useState<
    string | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const userIds = useMemo(() => users.map((u) => u.id), [users]);
  const selectedUsers = useMemo(
    () => users.filter((u) => selectedIds.has(u.id)),
    [users, selectedIds],
  );
  const hasSelection = selectedIds.size > 0;
  const allSelected =
    userIds.length > 0 && userIds.every((id) => selectedIds.has(id));
  const someSelected =
    userIds.some((id) => selectedIds.has(id)) && !allSelected;

  useEffect(() => {
    const valid = new Set(userIds);
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [userIds]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPassword("");
    setSendInvite(true);
    setRole("MANAGER");
    setOrganizationProfileId(null);
    setFormError(null);
    setShowValidation(false);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(u: StaffUser) {
    setEditingId(u.id);
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    setRole(u.role);
    setOrganizationProfileId(u.organizationProfileId ?? null);
    setFormError(null);
    setShowValidation(false);
    setSheetOpen(true);
  }

  function applyProfileSelection(value: string) {
    if (value.startsWith("profile:")) {
      const id = value.slice("profile:".length);
      setOrganizationProfileId(id);
      setRole("MANAGER");
      return;
    }
    if (value === "ADMIN" || value === "MANAGER") {
      setRole(value);
      setOrganizationProfileId(null);
    }
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  function toggleUser(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(userIds) : new Set());
  }

  function invalidateUsers() {
    void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    void qc.invalidateQueries({ queryKey: ["admin", "managers"] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        role,
        organizationProfileId,
      };
      if (password.length > 0) payload.password = password;

      if (editingId) {
        return apiFetch<StaffUser>(`/admin/users/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      const createBody: Record<string, unknown> = { ...payload };
      if (sendInvite || !password) {
        createBody.invite = true;
      } else {
        createBody.password = password;
      }
      return apiFetch<StaffUser>("/admin/users", {
        method: "POST",
        body: JSON.stringify(createBody),
      });
    },
    onSuccess: (data) => {
      invalidateUsers();
      closeSheet();
      if (!editingId && data.invited && data.inviteEmailSent === false) {
        setActionError(
          data.inviteEmailError ??
            "O usuário foi criado, mas o e-mail de convite não foi enviado.",
        );
      } else if (!editingId) {
        setActionError(null);
      }
    },
    onError: (err) => {
      setFormError(
        err instanceof Error
          ? err.message
          : editingId
            ? "Erro ao atualizar usuário"
            : "Erro ao criar usuário",
      );
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setActionError(null);
      invalidateUsers();
    },
    onError: (err) => {
      setActionError(
        err instanceof Error ? err.message : "Erro ao excluir usuário",
      );
    },
  });

  const resendInvite = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/users/${id}/resend-invite`, { method: "POST" }),
    onSuccess: () => {
      setActionError(null);
    },
    onError: (err) => {
      setActionError(
        err instanceof Error
          ? err.message
          : "Não foi possível reenviar o convite",
      );
    },
  });

  const batchDelete = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ deleted: number }>("/admin/users/batch-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      setActionError(null);
      setSelectedIds(new Set());
      invalidateUsers();
    },
    onError: (err) => {
      setActionError(
        err instanceof Error ? err.message : "Erro ao excluir usuários",
      );
    },
  });

  const batchRole = useMutation({
    mutationFn: ({
      ids,
      role: nextRole,
    }: {
      ids: string[];
      role: "ADMIN" | "MANAGER";
    }) =>
      apiFetch<{ updated: number }>("/admin/users/batch", {
        method: "PATCH",
        body: JSON.stringify({ ids, role: nextRole }),
      }),
    onSuccess: () => {
      setActionError(null);
      setBulkRole("");
      setSelectedIds(new Set());
      invalidateUsers();
    },
    onError: (err) => {
      setBulkRole("");
      setActionError(
        err instanceof Error ? err.message : "Erro ao alterar perfil",
      );
    },
  });

  const batchBusy = batchDelete.isPending || batchRole.isPending;

  const fieldErrors = useMemo(() => {
    if (!showValidation) return {} as Record<string, string>;
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome é obrigatório.";
    if (!email.trim()) e.email = "Email é obrigatório.";
    if (!editingId && !sendInvite && password.length < 6) {
      e.password = "Senha deve ter no mínimo 6 caracteres.";
    } else if (editingId && password.length > 0 && password.length < 6) {
      e.password = "Senha deve ter no mínimo 6 caracteres.";
    }
    if (!role) e.role = "Perfil é obrigatório.";
    return e;
  }, [showValidation, name, email, password, role, editingId, sendInvite]);

  useScrollToFirstError(
    Object.keys(fieldErrors).length > 0 ? fieldErrors : formError,
    { enabled: showValidation || Boolean(formError) },
  );

  function trySubmit() {
    setShowValidation(true);
    setFormError(null);
    if (!name.trim() || !email.trim() || !role) return;
    if (!editingId && !sendInvite && password.length < 6) return;
    if (editingId && password.length > 0 && password.length < 6) return;
    save.mutate();
  }

  async function confirmDeleteOne(u: StaffUser) {
    if (u.id === user?.id) {
      setActionError("Não é possível excluir a própria conta");
      return;
    }
    const ok = await confirm({
      title: "Excluir usuário?",
      description: `“${u.name}” (${u.email}) será removido permanentemente.`,
      confirmLabel: "Excluir",
      tone: "destructive",
    });
    if (ok) remove.mutate(u.id);
  }

  async function confirmBatchDelete() {
    if (!hasSelection || batchBusy) return;
    const includesSelf = user?.id ? selectedIds.has(user.id) : false;
    if (includesSelf) {
      setActionError("Não é possível excluir a própria conta");
      return;
    }
    const ok = await confirm({
      title: "Excluir usuários selecionados?",
      description: `${selectedUsers.length} usuário(s) serão removidos permanentemente.`,
      confirmLabel: "Excluir",
      tone: "destructive",
    });
    if (ok) batchDelete.mutate([...selectedIds]);
  }

  function applyBatchRole(nextRole: string) {
    if (!hasSelection || batchBusy) return;
    if (nextRole !== "ADMIN" && nextRole !== "MANAGER") return;
    setBulkRole(nextRole);
    batchRole.mutate({ ids: [...selectedIds], role: nextRole });
  }

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
        title={editingId ? "Editar usuário" : "Novo usuário"}
        description={
          editingId
            ? "Atualize nome, email, perfil ou defina uma nova senha."
            : "Envie um convite por e-mail (padrão) ou defina uma senha inicial."
        }
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={trySubmit}
            submitLabel={
              editingId
                ? "Salvar"
                : sendInvite
                  ? "Enviar convite"
                  : "Criar usuário"
            }
            pending={save.isPending}
          />
        }
      >
        <FormGrid cols={2}>
          <FormField
            label="Nome"
            htmlFor="user-name"
            required
            error={fieldErrors.name}
            className="sm:col-span-2"
          >
            <Input
              id="user-name"
              placeholder="Nome completo"
              aria-invalid={fieldErrors.name ? true : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </FormField>
          <FormField
            label="Email"
            htmlFor="user-email"
            required
            error={fieldErrors.email}
          >
            <Input
              id="user-email"
              type="email"
              placeholder="Email"
              aria-invalid={fieldErrors.email ? true : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </FormField>
          {!editingId ? (
            <FormField
              label="Convite por e-mail"
              htmlFor="user-invite"
              className="sm:col-span-2"
              hint="O usuário recebe um link para definir a própria senha."
            >
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="user-invite"
                  checked={sendInvite}
                  onCheckedChange={(v) => {
                    setSendInvite(v === true);
                    if (v === true) setPassword("");
                  }}
                />
                Enviar convite (recomendado)
              </label>
            </FormField>
          ) : null}
          {(editingId || !sendInvite) && (
            <FormField
              label="Senha"
              htmlFor="user-password"
              required={!editingId && !sendInvite}
              hint={
                editingId
                  ? "Deixe em branco para manter a senha atual"
                  : "Mínimo 6 caracteres"
              }
              error={fieldErrors.password}
            >
              <Input
                id="user-password"
                type="password"
                placeholder={
                  editingId ? "Nova senha (opcional)" : "Senha inicial"
                }
                aria-invalid={fieldErrors.password ? true : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
          )}
          <FormField
            label="Perfil"
            htmlFor="user-role"
            required
            error={fieldErrors.role}
            className="sm:col-span-2"
          >
            <AppSelect
              id="user-role"
              value={profileSelectValue(role, organizationProfileId)}
              onValueChange={applyProfileSelection}
              options={profileOptions}
              placeholder="Selecione o perfil"
            />
          </FormField>
        </FormGrid>
        <FormErrorBanner message={formError} className="mt-3" />
      </FormSheet>

      {!isLoading && users.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {hasSelection
              ? `${selectedUsers.length} usuário(s) selecionado(s)`
              : "Selecione usuários para alterar o perfil ou excluir em lote"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect
              value={bulkRole}
              disabled={!hasSelection || batchBusy}
              placeholder="Alterar perfil…"
              emptyLabel="Alterar perfil…"
              triggerClassName="w-[11.5rem]"
              options={CREATABLE_ROLES}
              onValueChange={(v) => applyBatchRole(v)}
            />
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!hasSelection || batchBusy}
              onClick={() => void confirmBatchDelete()}
            >
              {batchDelete.isPending ? "Excluindo…" : "Excluir selecionados"}
            </Button>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}

      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : null}

      {!isLoading && users.length === 0 ? (
        <p className="text-muted-foreground">Nenhum administrador ou gestor.</p>
      ) : null}

      {!isLoading && users.length > 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-4">
                  <Checkbox
                    checked={selectAllState(allSelected, someSelected)}
                    disabled={batchBusy}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead className="px-4">Nome</TableHead>
                <TableHead className="px-4">Email</TableHead>
                <TableHead className="px-4">Perfil</TableHead>
                <TableHead className="px-4">Criado em</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const selected = selectedIds.has(u.id);
                const isSelf = u.id === user?.id;
                return (
                  <TableRow
                    key={u.id}
                    className={cn(selected && "bg-muted/40")}
                  >
                    <TableCell className="px-4">
                      <Checkbox
                        checked={selected}
                        disabled={batchBusy}
                        onCheckedChange={(v) => toggleUser(u.id, v === true)}
                        aria-label={`Selecionar ${u.name}`}
                      />
                    </TableCell>
                    <TableCell className="px-4 font-medium">
                      {u.name}
                      {isSelf ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (você)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4">{u.email}</TableCell>
                    <TableCell className="px-4">
                      {staffProfileLabel(u)}
                    </TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 text-right whitespace-nowrap">
                      {!u.activatedAt ? (
                        <button
                          type="button"
                          className="mr-3 text-primary hover:underline disabled:opacity-40"
                          disabled={batchBusy || resendInvite.isPending}
                          onClick={() => resendInvite.mutate(u.id)}
                        >
                          Reenviar convite
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="mr-3 text-primary hover:underline"
                        disabled={batchBusy}
                        onClick={() => openEdit(u)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-destructive hover:underline disabled:opacity-40"
                        disabled={batchBusy || isSelf || remove.isPending}
                        onClick={() => void confirmDeleteOne(u)}
                      >
                        Excluir
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
