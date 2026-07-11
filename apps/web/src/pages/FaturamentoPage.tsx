import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  FISCAL_INVOICE_STATUS_LABELS,
  FISCAL_TAX_REGIME_LABELS,
  NFE_ENVIRONMENT_LABELS,
} from "@pedidos/shared";
import type { FiscalInvoiceStatus, FiscalTaxRegime, NfeEnvironment } from "@pedidos/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormGrid, FormSection } from "@/components/forms";
import { fieldControlClass } from "@/lib/field-styles";
import { apiFetch, downloadPdf, printPdf } from "../lib/api";
import { getErrorMessage } from "../lib/api-error";
import { notifyError, notifySuccess } from "../lib/app-notifications";
import { FiscalCadastrosPanel } from "../components/FiscalCadastrosPanel";

type Tab = "saida" | "entrada" | "cadastros" | "config";

type EligibleOrder = {
  id: string;
  status: string;
  totalAmount: unknown;
  createdAt: string;
  fiscalStatus: FiscalInvoiceStatus | "NONE";
  canEmit?: boolean;
  readinessIssues?: { code: string; message: string }[];
  customer: { id: string; name: string; document: string | null } | null;
  seller: { user: { name: string } };
  fiscalInvoice: { id: string; status: FiscalInvoiceStatus; number: number | null } | null;
};

type FiscalInvoice = {
  id: string;
  direction: string;
  status: FiscalInvoiceStatus;
  accessKey: string | null;
  number: number | null;
  series: number | null;
  totalAmount: unknown;
  issuedAt: string | null;
  stockApplied: boolean;
  supplier?: { name: string; document: string } | null;
  order?: { customer: { name: string } | null } | null;
  items: { id: string; description: string; quantity: unknown; productId: string | null }[];
};

type FiscalSettings = {
  configured: boolean;
  cnpj?: string | null;
  stateRegistration?: string | null;
  taxRegime?: FiscalTaxRegime;
  uf?: string | null;
  city?: string | null;
  street?: string | null;
  addressNumber?: string | null;
  zipCode?: string | null;
  nfeEnvironment?: NfeEnvironment;
  nfeSeries?: number;
  autoStockOnInboundInvoice?: boolean;
  certificate?: {
    uploaded: boolean;
    valid: boolean;
    warning: boolean;
    expiresAt: string | null;
    daysUntilExpiry: number | null;
  };
};

export function FaturamentoPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("saida");
  const [xmlPaste, setXmlPaste] = useState("");
  const [certPassword, setCertPassword] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["admin", "fiscal", "settings"],
    queryFn: () => apiFetch<FiscalSettings>("/admin/fiscal/settings"),
  });

  const { data: eligibleOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["admin", "fiscal", "outbound-orders"],
    queryFn: () => apiFetch<EligibleOrder[]>("/admin/fiscal/outbound/orders"),
    enabled: tab === "saida",
  });

  const { data: outboundInvoices = [] } = useQuery({
    queryKey: ["admin", "fiscal", "outbound-invoices"],
    queryFn: () => apiFetch<FiscalInvoice[]>("/admin/fiscal/outbound/invoices"),
    enabled: tab === "saida",
  });

  const { data: inboundInvoices = [] } = useQuery({
    queryKey: ["admin", "fiscal", "inbound-invoices"],
    queryFn: () => apiFetch<FiscalInvoice[]>("/admin/fiscal/inbound/invoices"),
    enabled: tab === "entrada",
  });

  const emitFromOrder = useMutation({
    mutationFn: (orderId: string) =>
      apiFetch(`/admin/fiscal/outbound/from-order/${orderId}`, { method: "POST" }),
    onSuccess: () => {
      notifySuccess("NF-e em rascunho criada com sucesso.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  const transmit = useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch(`/admin/fiscal/outbound/invoices/${invoiceId}/transmit`, { method: "POST" }),
    onSuccess: () => {
      notifySuccess("NF-e transmitida para a SEFAZ.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  const cancelOutbound = useMutation({
    mutationFn: ({ invoiceId, justification }: { invoiceId: string; justification: string }) =>
      apiFetch(`/admin/fiscal/outbound/invoices/${invoiceId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ justification }),
      }),
    onSuccess: () => {
      notifySuccess("Cancelamento enviado.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  const cancelInbound = useMutation({
    mutationFn: ({ invoiceId, justification }: { invoiceId: string; justification: string }) =>
      apiFetch(`/admin/fiscal/inbound/invoices/${invoiceId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ justification }),
      }),
    onSuccess: () => {
      notifySuccess("Cancelamento registrado.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  function promptCancel(onConfirm: (justification: string) => void) {
    const justification = window.prompt("Justificativa do cancelamento (mín. 15 caracteres):");
    if (!justification) return;
    if (justification.trim().length < 15) {
      notifyError("A justificativa deve ter no mínimo 15 caracteres.");
      return;
    }
    onConfirm(justification.trim());
  }

  function canShowDanfe(status: FiscalInvoiceStatus) {
    return status === "AUTHORIZED" || status === "IMPORTED" || status === "CANCELLED";
  }

  async function handleDanfe(invoiceId: string, number: number | null, action: "download" | "print") {
    const path = `/admin/fiscal/invoices/${invoiceId}/danfe.pdf`;
    const filename = `danfe-${number ?? invoiceId.slice(0, 8)}.pdf`;
    try {
      if (action === "download") await downloadPdf(path, filename);
      else await printPdf(path);
    } catch (e) {
      notifyError(getErrorMessage(e), "Falha ao gerar DANFE");
    }
  }

  const importXml = useMutation({
    mutationFn: () =>
      apiFetch("/admin/fiscal/inbound/import-xml", {
        method: "POST",
        body: JSON.stringify({ xml: xmlPaste }),
      }),
    onSuccess: () => {
      setXmlPaste("");
      notifySuccess("NF-e de entrada importada com sucesso.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  const saveSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/admin/fiscal/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      notifySuccess("Configurações fiscais salvas.");
      void refetchSettings();
    },
  });

  const uploadCert = useMutation({
    mutationFn: async () => {
      if (!certFile) throw new Error("Selecione o arquivo .pfx");
      const buf = await certFile.arrayBuffer();
      const pfxBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return apiFetch("/admin/fiscal/certificate", {
        method: "POST",
        body: JSON.stringify({ pfxBase64, password: certPassword }),
      });
    },
    onSuccess: () => {
      setCertPassword("");
      setCertFile(null);
      notifySuccess("Certificado A1 enviado com sucesso.");
      void refetchSettings();
    },
  });

  const [form, setForm] = useState({
    cnpj: "",
    stateRegistration: "",
    taxRegime: "SIMPLES_NACIONAL" as FiscalTaxRegime,
    uf: "",
    city: "",
    street: "",
    addressNumber: "",
    zipCode: "",
    nfeEnvironment: "HOMOLOGATION" as NfeEnvironment,
    nfeSeries: "1",
    autoStockOnInboundInvoice: false,
  });

  useEffect(() => {
    if (!settings?.configured) return;
    setForm({
      cnpj: settings.cnpj ?? "",
      stateRegistration: settings.stateRegistration ?? "",
      taxRegime: settings.taxRegime ?? "SIMPLES_NACIONAL",
      uf: settings.uf ?? "",
      city: settings.city ?? "",
      street: settings.street ?? "",
      addressNumber: settings.addressNumber ?? "",
      zipCode: settings.zipCode ?? "",
      nfeEnvironment: settings.nfeEnvironment ?? "HOMOLOGATION",
      nfeSeries: String(settings.nfeSeries ?? 1),
      autoStockOnInboundInvoice: settings.autoStockOnInboundInvoice ?? false,
    });
  }, [settings]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "saida", label: "NF-e de Saída" },
    { id: "entrada", label: "NF-e de Entrada" },
    { id: "cadastros", label: "NCM / CFOP" },
    { id: "config", label: "Configurações" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Faturamento</h1>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id ? "bg-primary text-white" : "bg-card border border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "saida" && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-medium">Pedidos confirmados</h2>
            {loadingOrders ? (
              <p className="text-muted-foreground">Carregando…</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-background text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Vendedor</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">NF-e</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleOrders.map((o) => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                        <td className="px-4 py-3">{o.customer?.name ?? "—"}</td>
                        <td className="px-4 py-3">{o.seller.user.name}</td>
                        <td className="px-4 py-3">R$ {Number(o.totalAmount).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {o.fiscalStatus === "NONE"
                            ? "Sem nota"
                            : FISCAL_INVOICE_STATUS_LABELS[o.fiscalStatus as FiscalInvoiceStatus]}
                        </td>
                        <td className="px-4 py-3">
                          {o.fiscalStatus === "NONE" || o.fiscalStatus === "REJECTED" ? (
                            <div className="space-y-1">
                              {o.readinessIssues && o.readinessIssues.length > 0 && (
                                <p className="max-w-xs text-xs text-amber-600">
                                  {o.readinessIssues.map((i) => i.message).join(" · ")}
                                </p>
                              )}
                              <Button
                                size="sm"
                                disabled={emitFromOrder.isPending || o.canEmit === false}
                                onClick={() => emitFromOrder.mutate(o.id)}
                              >
                                Emitir NF-e
                              </Button>
                            </div>
                          ) : o.fiscalInvoice?.status === "DRAFT" ? (
                            <Button
                              size="sm"
                              disabled={transmit.isPending}
                              onClick={() => transmit.mutate(o.fiscalInvoice!.id)}
                            >
                              Transmitir
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium">NF-e emitidas</h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-background text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Nº</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Chave</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {outboundInvoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        {inv.series}/{inv.number}
                      </td>
                      <td className="px-4 py-3">{inv.order?.customer?.name ?? "—"}</td>
                      <td className="px-4 py-3">{FISCAL_INVOICE_STATUS_LABELS[inv.status]}</td>
                      <td className="px-4 py-3">R$ {Number(inv.totalAmount).toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{inv.accessKey?.slice(0, 12) ?? "—"}…</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canShowDanfe(inv.status) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleDanfe(inv.id, inv.number, "download")}
                              >
                                DANFE
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleDanfe(inv.id, inv.number, "print")}
                              >
                                Imprimir
                              </Button>
                            </>
                          )}
                          {inv.status === "AUTHORIZED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={cancelOutbound.isPending}
                              onClick={() =>
                                promptCancel((justification) =>
                                  cancelOutbound.mutate({ invoiceId: inv.id, justification }),
                                )
                              }
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "entrada" && (
        <div className="space-y-6">
          <FormSection title="Importar XML manualmente">
            <p className="mb-3 text-sm text-muted-foreground">
              O padrão fiscal é o <strong>XML da NF-e</strong> (arquivo .xml), não o PDF do DANFE. Cole o XML ou envie o
              arquivo — após importar, o sistema gera o DANFE no layout oficial.
            </p>
            <textarea
              className={`${fieldControlClass} min-h-[120px] w-full font-mono text-xs`}
              placeholder="Cole o XML da NF-e de entrada aqui…"
              value={xmlPaste}
              onChange={(e) => setXmlPaste(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer text-sm text-primary underline-offset-4 hover:underline">
                Selecionar arquivo .xml
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const text = typeof reader.result === "string" ? reader.result : "";
                      setXmlPaste(text);
                    };
                    reader.onerror = () => notifyError("Não foi possível ler o arquivo XML.");
                    reader.readAsText(file, "UTF-8");
                    e.target.value = "";
                  }}
                />
              </label>
              <Button disabled={importXml.isPending || !xmlPaste.trim()} onClick={() => importXml.mutate()}>
                {importXml.isPending ? "Importando…" : "Importar NF-e"}
              </Button>
            </div>
            {settings?.autoStockOnInboundInvoice ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Estoque automático ativo — confirme o de-para dos produtos após importar.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Estoque automático desligado — apenas registro fiscal.
              </p>
            )}
          </FormSection>

          <section>
            <h2 className="mb-3 text-lg font-medium">Notas de entrada registradas</h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-background text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Fornecedor</th>
                    <th className="px-4 py-3">Nº</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Estoque</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {inboundInvoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-4 py-3">{inv.supplier?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {inv.series}/{inv.number}
                      </td>
                      <td className="px-4 py-3">R$ {Number(inv.totalAmount).toFixed(2)}</td>
                      <td className="px-4 py-3">{inv.stockApplied ? "Aplicado" : "Não"}</td>
                      <td className="px-4 py-3">{FISCAL_INVOICE_STATUS_LABELS[inv.status]}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canShowDanfe(inv.status) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleDanfe(inv.id, inv.number, "download")}
                              >
                                DANFE
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleDanfe(inv.id, inv.number, "print")}
                              >
                                Imprimir
                              </Button>
                            </>
                          )}
                          {(inv.status === "IMPORTED" || inv.status === "AUTHORIZED") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={cancelInbound.isPending}
                              onClick={() =>
                                promptCancel((justification) =>
                                  cancelInbound.mutate({ invoiceId: inv.id, justification }),
                                )
                              }
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "cadastros" && <FiscalCadastrosPanel />}

      {tab === "config" && (
        <div className="space-y-6">
          <FormSection title="Emitente">
            <FormGrid>
              <FormField label="CNPJ">
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
              </FormField>
              <FormField label="Inscrição estadual">
                <Input
                  value={form.stateRegistration}
                  onChange={(e) => setForm({ ...form, stateRegistration: e.target.value })}
                />
              </FormField>
              <FormField label="UF">
                <Input value={form.uf} maxLength={2} onChange={(e) => setForm({ ...form, uf: e.target.value })} />
              </FormField>
              <FormField label="Regime">
                <select
                  className={fieldControlClass}
                  value={form.taxRegime}
                  onChange={(e) => setForm({ ...form, taxRegime: e.target.value as FiscalTaxRegime })}
                >
                  {Object.entries(FISCAL_TAX_REGIME_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Ambiente NF-e">
                <select
                  className={fieldControlClass}
                  value={form.nfeEnvironment}
                  onChange={(e) => setForm({ ...form, nfeEnvironment: e.target.value as NfeEnvironment })}
                >
                  {Object.entries(NFE_ENVIRONMENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Série">
                <Input value={form.nfeSeries} onChange={(e) => setForm({ ...form, nfeSeries: e.target.value })} />
              </FormField>
            </FormGrid>
            <div className="mt-4">
              <Button
                onClick={() =>
                  saveSettings.mutate({
                    ...form,
                    nfeSeries: Number(form.nfeSeries) || 1,
                  })
                }
              >
                Salvar configurações
              </Button>
            </div>
          </FormSection>

          <FormSection title="Certificado A1">
            {settings?.certificate?.uploaded && (
              <p className={`mb-3 text-sm ${settings.certificate.warning ? "text-amber-600" : "text-muted-foreground"}`}>
                Certificado enviado
                {settings.certificate.expiresAt
                  ? ` — validade ${new Date(settings.certificate.expiresAt).toLocaleDateString("pt-BR")}`
                  : ""}
                {!settings.certificate.valid ? " (vencido)" : ""}
              </p>
            )}
            <FormGrid>
              <FormField label="Arquivo .pfx">
                <Input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                />
              </FormField>
              <FormField label="Senha do certificado">
                <Input
                  type="password"
                  value={certPassword}
                  onChange={(e) => setCertPassword(e.target.value)}
                />
              </FormField>
            </FormGrid>
            <Button className="mt-3" disabled={uploadCert.isPending} onClick={() => uploadCert.mutate()}>
              Enviar certificado
            </Button>
          </FormSection>

          <FormSection title="Estoque na NF-e de entrada">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.autoStockOnInboundInvoice}
                onChange={(e) =>
                  setForm({ ...form, autoStockOnInboundInvoice: e.target.checked })
                }
              />
              Lançar estoque automaticamente ao confirmar importação de NF-e de entrada
            </label>
            <p className="mt-2 text-sm text-muted-foreground">
              Quando desligado, use a tela Estoque para movimentações manuais.
            </p>
          </FormSection>
        </div>
      )}
    </div>
  );
}
