import { FormField } from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { DatePicker, parseIsoDate } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
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
  AUDIT_ACTION_FILTER_OPTIONS,
  AUDIT_ENTITY_FILTER_OPTIONS,
  auditEntityHref,
  auditSourceLabel,
  entityLabel,
  formatAuditDateTime,
  summarizeMetadata,
  type AuditLogsResponse,
} from "@/lib/audit-labels";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 50;

function dayStartIso(isoDate: string): string | undefined {
  const d = parseIsoDate(isoDate);
  if (!d) return undefined;
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayEndIso(isoDate: string): string | undefined {
  const d = parseIsoDate(isoDate);
  if (!d) return undefined;
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

type AuditLogsPanelProps = {
  embedded?: boolean;
};

export function AuditLogsPanel({ embedded = false }: AuditLogsPanelProps) {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [matricula, setMatricula] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("take", String(PAGE_SIZE));
    p.set("skip", String(page * PAGE_SIZE));
    if (action) p.set("action", action);
    if (entityType) p.set("entityType", entityType);
    if (matricula.trim()) p.set("matricula", matricula.trim());
    const fromIso = from ? dayStartIso(from) : undefined;
    const toIso = to ? dayEndIso(to) : undefined;
    if (fromIso) p.set("from", fromIso);
    if (toIso) p.set("to", toIso);
    return p.toString();
  }, [action, entityType, matricula, from, to, page]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "admin",
      "audit-logs",
      "page",
      action,
      entityType,
      matricula,
      from,
      to,
      page,
    ],
    queryFn: () =>
      apiFetch<AuditLogsResponse>(`/admin/audit-logs?${queryString}`),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  function resetFilters() {
    setAction("");
    setEntityType("");
    setMatricula("");
    setFrom("");
    setTo("");
    setPage(0);
  }

  function onFilterChange(fn: () => void) {
    fn();
    setPage(0);
  }

  return (
    <div className="space-y-6">
      {embedded ? (
        <p className="text-sm text-muted-foreground">
          Histórico de criações, edições e exclusões no painel e no app.
        </p>
      ) : (
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Auditoria</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico de criações, edições e exclusões no painel e no app.
          </p>
        </div>
      )}

      <div className="surface-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FormField label="Ação" htmlFor="audit-action">
          <AppSelect
            id="audit-action"
            value={action}
            onValueChange={(v) => onFilterChange(() => setAction(v))}
            emptyLabel="Todas"
            options={AUDIT_ACTION_FILTER_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />
        </FormField>
        <FormField label="Entidade" htmlFor="audit-entity">
          <AppSelect
            id="audit-entity"
            value={entityType}
            onValueChange={(v) => onFilterChange(() => setEntityType(v))}
            emptyLabel="Todas"
            options={AUDIT_ENTITY_FILTER_OPTIONS}
          />
        </FormField>
        <FormField label="Matrícula" htmlFor="audit-matricula">
          <Input
            id="audit-matricula"
            placeholder="Filtrar por matrícula"
            value={matricula}
            onChange={(e) => onFilterChange(() => setMatricula(e.target.value))}
          />
        </FormField>
        <FormField label="De" htmlFor="audit-from">
          <DatePicker
            id="audit-from"
            value={from}
            onChange={(v) => onFilterChange(() => setFrom(v))}
            placeholder="Início"
          />
        </FormField>
        <FormField label="Até" htmlFor="audit-to">
          <DatePicker
            id="audit-to"
            value={to}
            onChange={(v) => onFilterChange(() => setTo(v))}
            placeholder="Fim"
          />
        </FormField>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={resetFilters}
          >
            Limpar filtros
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {isLoading && !data
            ? "Carregando…"
            : `${total} registro${total === 1 ? "" : "s"}`}
          {isFetching && data ? " · atualizando…" : null}
        </span>
        <span>
          Página {Math.min(page + 1, totalPages)} de {totalPages}
        </span>
      </div>

      {isLoading && !data ? (
        <p className="text-muted-foreground">Carregando auditoria…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar os registros de auditoria.
        </p>
      ) : items.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <History className="h-12 w-12 text-primary/40" />
          <p className="text-muted-foreground">
            Nenhum registro encontrado com esses filtros.
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Data/hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const href = auditEntityHref(row.entityType, row.entityId);
                const mat =
                  row.userMatricula?.trim() ||
                  row.user?.matricula?.trim() ||
                  null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {formatAuditDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {actionLabel(row.action)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-0.5">
                        <span>{entityLabel(row.entityType)}</span>
                        {row.entityId ? (
                          href ? (
                            <Link
                              to={href}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {row.entityId.length > 14
                                ? `${row.entityId.slice(0, 12)}…`
                                : row.entityId}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              {row.entityId.length > 14
                                ? `${row.entityId.slice(0, 12)}…`
                                : row.entityId}
                            </span>
                          )
                        ) : href ? (
                          <Link
                            to={href}
                            className="text-xs text-primary hover:underline"
                          >
                            Abrir
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-0.5">
                        <span>{row.user?.name ?? "—"}</span>
                        {row.user?.email ? (
                          <span className="text-xs text-muted-foreground">
                            {row.user.email}
                          </span>
                        ) : null}
                        {mat ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {mat}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {auditSourceLabel(row.metadata, Boolean(row.user))}
                    </TableCell>
                    <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                      <span
                        className="line-clamp-2"
                        title={summarizeMetadata(row.metadata)}
                      >
                        {summarizeMetadata(row.metadata)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPrev || isFetching}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canNext || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function AuditLogsPage() {
  return <AuditLogsPanel />;
}
