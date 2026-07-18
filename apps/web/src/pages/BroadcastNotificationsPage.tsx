import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/app-notifications";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Send } from "lucide-react";
import { useMemo, useState } from "react";

type Seller = {
  id: string;
  active: boolean;
  user: { id: string; name: string; email: string };
};

export function BroadcastNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sellerQuery, setSellerQuery] = useState("");

  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const activeSellers = useMemo(
    () =>
      [...sellers]
        .filter((s) => s.active)
        .sort((a, b) => a.user.name.localeCompare(b.user.name, "pt-BR")),
    [sellers],
  );

  const filteredSellers = useMemo(() => {
    const q = sellerQuery.trim().toLowerCase();
    if (!q) return activeSellers;
    return activeSellers.filter(
      (s) =>
        s.user.name.toLowerCase().includes(q) ||
        s.user.email.toLowerCase().includes(q),
    );
  }, [activeSellers, sellerQuery]);

  const allFilteredSelected =
    filteredSellers.length > 0 &&
    filteredSellers.every((s) => selectedIds.has(s.id));

  function toggleSeller(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const s of filteredSellers) next.delete(s.id);
      } else {
        for (const s of filteredSellers) next.add(s.id);
      }
      return next;
    });
  }

  const send = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true; sent: number }>("/admin/notifications/send", {
        method: "POST",
        body: JSON.stringify({
          sellerIds: [...selectedIds],
          title: title.trim(),
          body: body.trim(),
        }),
      }),
    onSuccess: (res) => {
      notifySuccess(
        `Notificação enviada para ${res.sent} vendedor${res.sent === 1 ? "" : "es"}.`,
      );
      setTitle("");
      setBody("");
      setSelectedIds(new Set());
    },
    onError: (e: Error) => {
      notifyError(e.message || "Falha ao enviar notificação.");
    },
  });

  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    selectedIds.size > 0 &&
    !send.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Bell className="size-6 text-primary" />
          Notificar vendedores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie uma mensagem com título e corpo para vendedores específicos.
          Eles recebem na inbox do app e, se tiverem push ativo, no telemóvel.
        </p>
      </div>

      <div className="surface-card space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="broadcast-title">Título</Label>
          <Input
            id="broadcast-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Aviso importante"
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="broadcast-body">Mensagem</Label>
          <Textarea
            id="broadcast-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva o corpo da notificação…"
            rows={5}
            maxLength={2000}
            className="resize-y"
          />
          <p className="text-xs text-muted-foreground">
            {body.trim().length}/2000
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Label>Destinatários</Label>
              <p className="text-xs text-muted-foreground">
                {selectedIds.size} selecionado
                {selectedIds.size === 1 ? "" : "s"}
              </p>
            </div>
            <Input
              value={sellerQuery}
              onChange={(e) => setSellerQuery(e.target.value)}
              placeholder="Filtrar por nome ou e-mail…"
              className="sm:max-w-xs"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              A carregar vendedores…
            </p>
          ) : activeSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum vendedor ativo no seu escopo.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b border-border bg-muted/40 px-4 py-3",
                )}
              >
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={() => toggleAllFiltered()}
                  aria-label="Selecionar todos filtrados"
                />
                <span className="text-sm font-medium">
                  {allFilteredSelected
                    ? "Desmarcar filtrados"
                    : "Selecionar todos filtrados"}
                </span>
              </label>
              <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                {filteredSellers.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhum resultado para o filtro.
                  </li>
                ) : (
                  filteredSellers.map((s) => {
                    const checked = selectedIds.has(s.id);
                    const inputId = `broadcast-seller-${s.id}`;
                    return (
                      <li key={s.id}>
                        <label
                          htmlFor={inputId}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                            "hover:bg-accent/40",
                            checked && "bg-primary/5",
                          )}
                        >
                          <Checkbox
                            id={inputId}
                            checked={checked}
                            onCheckedChange={() => toggleSeller(s.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {s.user.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.user.email}
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => send.mutate()}
          >
            <Send className="size-4" />
            {send.isPending ? "A enviar…" : "Enviar notificação"}
          </Button>
        </div>
      </div>
    </div>
  );
}
