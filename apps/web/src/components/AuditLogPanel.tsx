import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import {
  actionLabel,
  formatAuditDateTime,
  summarizeMetadata,
  type AuditLogRow,
  type AuditLogsResponse,
} from "@/lib/audit-labels";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export type { AuditLogRow };

type AuditLogPanelProps = {
  entityType?: string;
  entityId?: string;
  action?: string;
  title?: string;
  take?: number;
  className?: string;
  /** Quando false, não busca (ex.: sheet fechado). Default true. */
  enabled?: boolean;
};

export function AuditLogPanel({
  entityType,
  entityId,
  action,
  title = "Histórico de alterações",
  take = 30,
  className,
  enabled = true,
}: AuditLogPanelProps) {
  const params = new URLSearchParams();
  params.set("take", String(take));
  if (entityType) params.set("entityType", entityType);
  if (entityId) params.set("entityId", entityId);
  if (action) params.set("action", action);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "admin",
      "audit-logs",
      entityType ?? null,
      entityId ?? null,
      action ?? null,
      take,
    ],
    queryFn: () =>
      apiFetch<AuditLogsResponse>(`/admin/audit-logs?${params.toString()}`),
    enabled,
  });

  const items = data?.items ?? [];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {data != null ? (
          <span className="text-xs text-muted-foreground">
            {data.total} registro{data.total === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando histórico…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar o histórico.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma alteração registrada ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Data/hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">
                    {formatAuditDateTime(row.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {actionLabel(row.action)}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {row.userMatricula?.trim() ||
                      row.user?.matricula?.trim() ||
                      "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.user?.name ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                    {summarizeMetadata(row.metadata)}
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
