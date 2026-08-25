import {
  FormErrorBanner,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { getErrorMessage } from "../lib/api-error";

type Provider = "ITAU" | "BB" | "SANTANDER";

type BankConnection = {
  id: string;
  provider: Provider;
  status: string;
  metadata: {
    agency: string | null;
    account: string | null;
    wallet: string | null;
    covenantCode: string | null;
    workspaceId: string | null;
    beneficiaryCode: string | null;
    environment: string | null;
    label: string | null;
  };
  hasCredentialsEnvPrefix: boolean;
  hasEncryptedCredentials: boolean;
  hasWebhookSecret: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

const PROVIDER_LABEL: Record<Provider, string> = {
  ITAU: "Itaú",
  BB: "Banco do Brasil",
  SANTANDER: "Santander",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_SETUP: "Aguardando setup",
  ACTIVE: "Ativa",
  ERROR: "Erro",
  DISCONNECTED: "Desconectada",
};

function emptyForm() {
  return {
    provider: "SANTANDER" as Provider,
    agency: "",
    account: "",
    wallet: "",
    covenantCode: "",
    workspaceId: "",
    beneficiaryCode: "",
    environment: "sandbox" as "sandbox" | "production",
    credentialsEnvPrefix: "",
    webhookSecret: "",
  };
}

export function BankingIntegrationsPage() {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["admin", "banking", "connections"],
    queryFn: () =>
      apiFetch<BankConnection[]>("/admin/banking/connections"),
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch<BankConnection>("/admin/banking/connections", {
        method: "POST",
        body: JSON.stringify({
          provider: form.provider,
          metadata: {
            agency: form.agency || undefined,
            account: form.account || undefined,
            wallet: form.wallet || undefined,
            covenantCode: form.covenantCode || undefined,
            workspaceId: form.workspaceId || undefined,
            beneficiaryCode: form.beneficiaryCode || undefined,
            environment: form.environment,
          },
          credentialsEnvPrefix: form.credentialsEnvPrefix || null,
          webhookSecret: form.webhookSecret || undefined,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "banking"] });
      setSheetOpen(false);
      setForm(emptyForm());
      setError(null);
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/banking/connections/${id}/disconnect`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "banking"] }),
  });

  const sync = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/banking/connections/${id}/sync`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "banking"] }),
  });

  const connectedProviders = new Set(connections.map((c) => c.provider));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Início
          </Link>
          <span className="mx-1.5">›</span>
          <Link to="/financeiro" className="hover:text-foreground">
            Financeiro
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">Integrações bancárias</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Integrações bancárias
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Conciliação de boletos dos seus clientes (Itaú, BB, Santander).
              Segredos ficam só no servidor (env / criptografia) — nunca no
              navegador.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setForm(emptyForm());
              setError(null);
              setSheetOpen(true);
            }}
          >
            <Link2 className="size-4" />
            Conectar banco
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma conexão. Configure o convênio e o prefixo de variáveis de
          ambiente com as credenciais do portal do banco.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Convênio / workspace</TableHead>
                <TableHead>Credenciais</TableHead>
                <TableHead>Última sync</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {PROVIDER_LABEL[c.provider]}
                    <div className="text-xs text-muted-foreground">
                      {c.metadata.environment ?? "sandbox"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {STATUS_LABEL[c.status] ?? c.status}
                    {c.lastError ? (
                      <div className="max-w-xs truncate text-xs text-destructive">
                        {c.lastError}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[
                      c.metadata.covenantCode &&
                        `Convênio ${c.metadata.covenantCode}`,
                      c.metadata.workspaceId &&
                        `WS ${c.metadata.workspaceId}`,
                      c.metadata.agency && `Ag ${c.metadata.agency}`,
                      c.metadata.account && `Cc ${c.metadata.account}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.hasCredentialsEnvPrefix || c.hasEncryptedCredentials
                      ? "Configuradas"
                      : "Pendentes"}
                    {c.hasWebhookSecret ? " · webhook ok" : ""}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.lastSyncAt
                      ? new Date(c.lastSyncAt).toLocaleString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={sync.isPending}
                      onClick={() => sync.mutate(c.id)}
                    >
                      <RefreshCw className="size-4" />
                      Sync
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={
                        disconnect.isPending || c.status === "DISCONNECTED"
                      }
                      onClick={() => disconnect.mutate(c.id)}
                    >
                      <Unplug className="size-4" />
                      Desconectar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Conectar banco"
        description="Informe dados do convênio (não-secretos). Secrets via prefixo de env no servidor."
      >
        <FormErrorBanner message={error} />
        <FormGrid>
          <FormField label="Banco">
            <AppSelect
              value={form.provider}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, provider: v as Provider }))
              }
              options={(["ITAU", "BB", "SANTANDER"] as Provider[])
                .filter((p) => !connectedProviders.has(p))
                .map((p) => ({ value: p, label: PROVIDER_LABEL[p] }))}
            />
          </FormField>
          <FormField label="Ambiente">
            <AppSelect
              value={form.environment}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  environment: v as "sandbox" | "production",
                }))
              }
              options={[
                { value: "sandbox", label: "Sandbox / homologação" },
                { value: "production", label: "Produção" },
              ]}
            />
          </FormField>
          <FormField label="Agência">
            <Input
              value={form.agency}
              onChange={(e) =>
                setForm((f) => ({ ...f, agency: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Conta">
            <Input
              value={form.account}
              onChange={(e) =>
                setForm((f) => ({ ...f, account: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Carteira">
            <Input
              value={form.wallet}
              onChange={(e) =>
                setForm((f) => ({ ...f, wallet: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Código do convênio">
            <Input
              value={form.covenantCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, covenantCode: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Workspace ID (Santander)">
            <Input
              value={form.workspaceId}
              onChange={(e) =>
                setForm((f) => ({ ...f, workspaceId: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Beneficiary code (Santander)">
            <Input
              value={form.beneficiaryCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, beneficiaryCode: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Prefixo env de secrets">
            <Input
              value={form.credentialsEnvPrefix}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  credentialsEnvPrefix: e.target.value,
                }))
              }
              placeholder="BANKING_SANTANDER_ORG_"
            />
          </FormField>
          <p className="col-span-full text-xs text-muted-foreground">
            Ex.: BANKING_SANTANDER_ACME_ → CLIENT_ID, CLIENT_SECRET, APP_KEY…
          </p>
          <FormField label="Webhook secret (opcional)">
            <Input
              type="password"
              autoComplete="new-password"
              value={form.webhookSecret}
              onChange={(e) =>
                setForm((f) => ({ ...f, webhookSecret: e.target.value }))
              }
            />
          </FormField>
          <p className="col-span-full text-xs text-muted-foreground">
            Token esperado no header x-banking-webhook-token
          </p>
        </FormGrid>
        <FormSheetActions
          onCancel={() => setSheetOpen(false)}
          onSubmit={() => save.mutate()}
          submitLabel="Salvar conexão"
          pending={save.isPending}
        />
      </FormSheet>
    </div>
  );
}
