import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

type PermissionLevel = "none" | "read" | "write";

type PermissionsMatrix = {
  roles: Array<{
    role: string;
    label: string;
    hasSellerProfile: boolean;
    locked?: boolean;
  }>;
  resources: Array<{
    resource: string;
    label: string;
    levels: Record<string, PermissionLevel>;
  }>;
  editableRoles?: string[];
  lockedRoles?: string[];
  notes: string[];
};

const LEVEL_OPTIONS = [
  { value: "none", label: "Sem acesso" },
  { value: "read", label: "Leitura" },
  { value: "write", label: "Escrita" },
];

const LEVEL_LABEL: Record<PermissionLevel, string> = {
  none: "—",
  read: "Leitura",
  write: "Escrita",
};

function matrixToDraft(
  data: PermissionsMatrix,
): Record<string, Record<string, PermissionLevel>> {
  const draft: Record<string, Record<string, PermissionLevel>> = {};
  for (const role of data.roles) {
    draft[role.role] = {};
    for (const row of data.resources) {
      draft[role.role][row.resource] = row.levels[role.role] ?? "none";
    }
  }
  return draft;
}

export function PermissionsPage() {
  const qc = useQueryClient();
  const { confirm, alert } = useConfirm();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => apiFetch<PermissionsMatrix>("/admin/permissions"),
  });

  const [draft, setDraft] = useState<Record<
    string,
    Record<string, PermissionLevel>
  > | null>(null);

  useEffect(() => {
    if (data) setDraft(matrixToDraft(data));
  }, [data]);

  const dirty = useMemo(() => {
    if (!data || !draft) return false;
    for (const role of data.roles) {
      if (role.locked) continue;
      for (const row of data.resources) {
        const server = row.levels[role.role] ?? "none";
        const local = draft[role.role]?.[row.resource] ?? "none";
        if (server !== local) return true;
      }
    }
    return false;
  }, [data, draft]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data || !draft) throw new Error("Matriz não carregada");
      const updates: Array<{
        role: string;
        resource: string;
        level: PermissionLevel;
      }> = [];
      for (const role of data.roles) {
        if (role.locked) continue;
        for (const row of data.resources) {
          const level = draft[role.role]?.[row.resource] ?? "none";
          updates.push({ role: role.role, resource: row.resource, level });
        }
      }
      return apiFetch<PermissionsMatrix>("/admin/permissions", {
        method: "PUT",
        body: JSON.stringify({ updates }),
      });
    },
    onSuccess: async (matrix) => {
      setDraft(matrixToDraft(matrix));
      await qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      // Recarrega sessão para nav/guards refletirem overrides do próprio role (se aplicável).
      window.dispatchEvent(new Event("pedidos:auth-refresh"));
      await alert({
        title: "Permissões salvas",
        description: "A matriz da organização foi atualizada.",
        tone: "default",
      });
    },
    onError: async (err) => {
      await alert({
        title: "Falha ao salvar",
        description: (err as Error).message,
        tone: "danger",
      });
    },
  });

  async function handleSave() {
    if (!dirty) return;
    const ok = await confirm({
      title: "Salvar matriz de permissões?",
      description:
        "Gestores e outros roles passarão a ver/navegar conforme os novos níveis. A coluna Administrador não é alterada.",
      confirmLabel: "Salvar",
      tone: "default",
    });
    if (!ok) return;
    save.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Permissões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina leitura/escrita por role. Alterações são salvas por
            organização.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              Alterações não salvas
            </span>
          ) : null}
          <Button
            type="button"
            disabled={!dirty || save.isPending || !draft}
            onClick={() => void handleSave()}
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : error ? (
        <p className="text-destructive">{(error as Error).message}</p>
      ) : data && draft ? (
        <>
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurso</TableHead>
                  {data.roles.map((r) => (
                    <TableHead key={r.role}>
                      <div>{r.label}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {r.locked
                          ? "Bloqueado (somente leitura)"
                          : r.hasSellerProfile
                            ? "Com perfil vendedor"
                            : "Sem perfil vendedor"}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.resources.map((row) => (
                  <TableRow key={row.resource}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    {data.roles.map((r) => {
                      const locked = !!r.locked;
                      const value =
                        draft[r.role]?.[row.resource] ??
                        row.levels[r.role] ??
                        "none";
                      return (
                        <TableCell key={r.role}>
                          {locked ? (
                            <span className="text-sm text-muted-foreground">
                              {LEVEL_LABEL[value]}
                            </span>
                          ) : (
                            <AppSelect
                              value={value}
                              onValueChange={(next) => {
                                setDraft((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    [r.role]: {
                                      ...prev[r.role],
                                      [row.resource]: next as PermissionLevel,
                                    },
                                  };
                                });
                              }}
                              options={LEVEL_OPTIONS}
                              triggerClassName="min-w-[8.5rem]"
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
