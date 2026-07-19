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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type SellerOption = {
  id: string;
  user: { name: string; email: string };
  team: { id: string; name: string } | null;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  isLeader: boolean;
};

type SalesTeam = {
  id: string;
  name: string;
  leaderSellerId: string;
  leader: { id: string; name: string; email: string };
  memberCount: number;
  members: TeamMember[];
};

export function TeamsPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["admin", "teams"],
    queryFn: () => apiFetch<SalesTeam[]>("/admin/teams"),
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<SellerOption[]>("/admin/sellers"),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [leaderSellerId, setLeaderSellerId] = useState("");
  const [memberSellerIds, setMemberSellerIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const availableSellers = useMemo(() => {
    return sellers.filter((s) => !s.team || s.team.id === editingId);
  }, [sellers, editingId]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setLeaderSellerId("");
    setMemberSellerIds([]);
    setFormError(null);
    setShowValidation(false);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(team: SalesTeam) {
    setEditingId(team.id);
    setName(team.name);
    setLeaderSellerId(team.leaderSellerId);
    setMemberSellerIds(team.members.map((m) => m.id));
    setFormError(null);
    setShowValidation(false);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  function toggleMember(id: string) {
    setMemberSellerIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function ensureLeaderInMembers(leaderId: string, members: string[]) {
    if (!leaderId) return members;
    return members.includes(leaderId) ? members : [...members, leaderId];
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        leaderSellerId,
        memberSellerIds: ensureLeaderInMembers(leaderSellerId, memberSellerIds),
      };
      if (editingId) {
        return apiFetch<SalesTeam>(`/admin/teams/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<SalesTeam>("/admin/teams", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "teams"] });
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/teams/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "teams"] });
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] });
      resetForm();
    },
  });

  const canSave =
    name.trim().length > 0 &&
    leaderSellerId.length > 0 &&
    ensureLeaderInMembers(leaderSellerId, memberSellerIds).length > 0;

  const fieldErrors = useMemo(() => {
    if (!showValidation) return {} as Record<string, string>;
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome da equipe é obrigatório.";
    if (!leaderSellerId) e.leaderSellerId = "Selecione o líder.";
    return e;
  }, [showValidation, name, leaderSellerId]);

  useScrollToFirstError(
    Object.keys(fieldErrors).length > 0 ? fieldErrors : formError,
    { enabled: showValidation || Boolean(formError) },
  );

  function trySubmit() {
    setShowValidation(true);
    setFormError(null);
    if (!canSave) return;
    save.mutate();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Equipes de vendas
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Crie equipes nomeadas, defina um vendedor líder e escolha os
            membros. O líder ganha acesso ao painel web limitado à equipe.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Nova equipe
        </Button>
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title={editingId ? "Editar equipe" : "Nova equipe"}
        description="Nomeie a equipe, escolha o líder e marque os membros."
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={trySubmit}
            submitLabel={editingId ? "Salvar alterações" : "Criar equipe"}
            pending={save.isPending}
          />
        }
      >
        <FormGrid cols={2}>
          <FormField
            label="Nome da equipe"
            htmlFor="team-name"
            required
            error={fieldErrors.name}
            className="sm:col-span-2"
          >
            <Input
              id="team-name"
              aria-invalid={fieldErrors.name ? true : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Equipe Sul"
            />
          </FormField>

          <FormField
            label="Líder"
            htmlFor="team-leader"
            required
            error={fieldErrors.leaderSellerId}
          >
            <AppSelect
              id="team-leader"
              value={leaderSellerId}
              emptyLabel="Selecione…"
              placeholder="Selecione…"
              options={availableSellers.map((s) => ({
                value: s.id,
                label: `${s.user.name} (${s.user.email})`,
              }))}
              onValueChange={(id) => {
                setLeaderSellerId(id);
                if (id)
                  setMemberSellerIds((prev) => ensureLeaderInMembers(id, prev));
              }}
            />
          </FormField>

          <FormField label="Membros" className="sm:col-span-2">
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
              {availableSellers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum vendedor disponível.
                </p>
              ) : (
                availableSellers.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={memberSellerIds.includes(s.id)}
                      onCheckedChange={() => toggleMember(s.id)}
                    />
                    <span>
                      {s.user.name}
                      <span className="text-muted-foreground">
                        {" "}
                        — {s.user.email}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              O líder é incluído automaticamente como membro.
            </p>
          </FormField>
        </FormGrid>

        <FormErrorBanner message={formError} className="mt-3" />
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando equipes…</p>
      ) : teams.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Nenhuma equipe cadastrada ainda.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Equipe</TableHead>
                <TableHead className="px-4">Líder</TableHead>
                <TableHead className="px-4">Membros</TableHead>
                <TableHead className="px-4 w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="px-4 py-3 font-medium text-foreground">
                    {team.name}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-foreground">
                    {team.leader.name}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {team.memberCount}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-3 text-primary hover:underline"
                      onClick={() => openEdit(team)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      onClick={() => {
                        void confirm({
                          title: "Excluir equipe?",
                          description: `A equipe “${team.name}” será removida permanentemente.`,
                          confirmLabel: "Excluir",
                          tone: "destructive",
                        }).then((ok) => {
                          if (ok) remove.mutate(team.id);
                        });
                      }}
                    >
                      Excluir
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
