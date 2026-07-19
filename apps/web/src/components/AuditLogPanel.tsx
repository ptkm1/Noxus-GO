import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userMatricula: string | null;
  metadata: unknown;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    matricula: string | null;
  } | null;
};

type AuditLogsResponse = {
  items: AuditLogRow[];
  total: number;
  take: number;
  skip: number;
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Atualização",
  DELETE: "Exclusão",
  STATUS_CHANGE: "Mudança de status",
  STOCK_ENTRY: "Movimentação de estoque",
  STOCK_SALE: "Baixa por venda",
  STOCK_SALE_REVERSAL: "Estorno de venda",
  NFE_EMIT: "Emissão NF-e",
  NFE_TRANSMIT: "Transmissão NF-e",
  NFE_CANCEL: "Cancelamento NF-e",
  NFE_IMPORT: "Importação NF-e",
  NFE_CONFIRM_IMPORT: "Confirmação de importação",
  FISCAL_SETTINGS: "Config. fiscal",
  FISCAL_CERTIFICATE: "Certificado digital",
  FISCAL_LOGO: "Logo DANFE",
  PERMISSIONS_UPDATE: "Permissões",
  // legado (antes da padronização)
  "product.create": "Criação",
  "product.delete": "Exclusão",
  "user.create": "Criação",
  "stock.sale": "Baixa por venda",
  "stock.sale_reversal": "Estorno de venda",
  PERMISSIONS_MATRIX_UPDATE: "Permissões",
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith("stock.")) return "Movimentação de estoque";
  return action;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeMetadata(metadata: unknown): string {
  if (metadata == null) return "—";
  if (typeof metadata !== "object") return String(metadata);
  const obj = metadata as Record<string, unknown>;
  const parts: string[] = [];
  const pick = [
    "name",
    "fromStatus",
    "toStatus",
    "status",
    "movementType",
    "qtyDelta",
    "lotCode",
    "reason",
    "fields",
    "justification",
    "accessKey",
    "number",
    "op",
  ] as const;
  for (const key of pick) {
    const v = obj[key];
    if (v == null) continue;
    if (key === "fields" && Array.isArray(v)) {
      parts.push(`campos: ${v.join(", ")}`);
      continue;
    }
    if (key === "fromStatus" || key === "toStatus") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      parts.push(`${key}: ${v}`);
    }
  }
  if (obj.fromStatus != null || obj.toStatus != null) {
    parts.unshift(`${String(obj.fromStatus ?? "?")} → ${String(obj.toStatus ?? "?")}`);
  }
  if (parts.length === 0) {
    try {
      const raw = JSON.stringify(metadata);
      return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
    } catch {
      return "—";
    }
  }
  return parts.join(" · ");
}

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
                    {formatDateTime(row.createdAt)}
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
