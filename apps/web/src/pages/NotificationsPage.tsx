import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

function orderIdFromBody(body: string): string | null {
  const m = body.match(/ORDER_ID:([^\s\n]+)/);
  return m?.[1] ?? null;
}

function bodyWithoutOrderTag(body: string): string {
  return body.replace(/\n?ORDER_ID:[^\s\n]+$/, "").trim();
}

export function NotificationsPage() {
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: () => apiFetch<NotificationRow[]>("/admin/notifications"),
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/notifications/${id}/read`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      void qc.invalidateQueries({ queryKey: ["admin", "notifications-unread"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () =>
      apiFetch("/admin/notifications/read-all", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      void qc.invalidateQueries({ queryKey: ["admin", "notifications-unread"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Alertas</h1>
          <p className="mt-1 text-sm text-slate-600">
            Notificações da organização (ex.: pedidos aguardando aprovação de crédito).
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={markAll.isPending || items.every((n) => n.read)}
          onClick={() => markAll.mutate()}
        >
          Marcar todas como lidas
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-600">
          Nenhum alerta por aqui.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const oid = orderIdFromBody(n.body);
            const text = bodyWithoutOrderTag(n.body);
            return (
              <li
                key={n.id}
                className={`rounded-xl border px-4 py-4 ${
                  n.read ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/80"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <p className="text-sm text-slate-700">{text}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(n.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {oid ? (
                      <Link
                        to={`/vendas/${oid}`}
                        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                      >
                        Abrir pedido
                      </Link>
                    ) : null}
                    {!n.read ? (
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={markRead.isPending}
                        onClick={() => markRead.mutate(n.id)}
                      >
                        Marcar lida
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
