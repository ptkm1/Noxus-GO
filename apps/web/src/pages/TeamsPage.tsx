import {
  FormActions,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldControlClass } from "@/lib/field-styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["admin", "teams"],
    queryFn: () => apiFetch<SalesTeam[]>("/admin/teams"),
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<SellerOption[]>("/admin/sellers"),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [leaderSellerId, setLeaderSellerId] = useState("");
  const [memberSellerIds, setMemberSellerIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const editingTeam = teams.find((t) => t.id === editingId);

  useEffect(() => {
    if (editingTeam) {
      setName(editingTeam.name);
      setLeaderSellerId(editingTeam.leaderSellerId);
      setMemberSellerIds(editingTeam.members.map((m) => m.id));
    }
  }, [editingTeam]);

  const availableSellers = useMemo(() => {
    return sellers.filter((s) => !s.team || s.team.id === editingId);
  }, [sellers, editingId]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setLeaderSellerId("");
    setMemberSellerIds([]);
    setFormError(null);
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
      resetForm();
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Equipes de vendas
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Crie equipes nomeadas, defina um vendedor líder e escolha os membros.
          O líder ganha acesso ao painel web limitado à equipe.
        </p>
      </div>

      <FormSection title={editingId ? "Editar equipe" : "Nova equipe"}>
        <FormGrid cols={2} className="max-w-3xl">
          <FormField
            label="Nome da equipe"
            htmlFor="team-name"
            required
            className="sm:col-span-2"
          >
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Equipe Sul"
            />
          </FormField>

          <FormField label="Líder" htmlFor="team-leader" required>
            <select
              id="team-leader"
              className={fieldControlClass}
              value={leaderSellerId}
              onChange={(e) => {
                const id = e.target.value;
                setLeaderSellerId(id);
                if (id)
                  setMemberSellerIds((prev) => ensureLeaderInMembers(id, prev));
              }}
            >
              <option value="">Selecione…</option>
              {availableSellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.user.name} ({s.user.email})
                </option>
              ))}
            </select>
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
                    <input
                      type="checkbox"
                      checked={memberSellerIds.includes(s.id)}
                      onChange={() => toggleMember(s.id)}
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

        {formError ? (
          <p className="mt-3 text-sm text-destructive">{formError}</p>
        ) : null}

        <FormActions>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              setFormError(null);
              save.mutate();
            }}
            disabled={!canSave || save.isPending}
          >
            {save.isPending
              ? "Salvando…"
              : editingId
                ? "Salvar alterações"
                : "Criar equipe"}
          </Button>
        </FormActions>
      </FormSection>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando equipes…</p>
      ) : teams.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Nenhuma equipe cadastrada ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Equipe</th>
                <th className="px-4 py-3">Líder</th>
                <th className="px-4 py-3">Membros</th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {team.name}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {team.leader.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {team.memberCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-3 text-primary hover:underline"
                      onClick={() => setEditingId(team.id)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      onClick={() => {
                        if (confirm(`Excluir a equipe "${team.name}"?`))
                          remove.mutate(team.id);
                      }}
                    >
                      Excluir
                    </button>
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
