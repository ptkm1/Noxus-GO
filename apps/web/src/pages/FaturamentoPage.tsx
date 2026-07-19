import { AuditLogPanel } from "@/components/AuditLogPanel";
import { FormField, FormGrid, FormSection } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { fieldControlClass } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import type {
  FiscalInvoiceStatus,
  FiscalTaxRegime,
  NfeEnvironment,
} from "@pedidos/shared";
import {
  FISCAL_INVOICE_STATUS_LABELS,
  FISCAL_TAX_REGIME_LABELS,
  NFE_ENVIRONMENT_LABELS,
} from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FiscalCadastrosPanel } from "../components/FiscalCadastrosPanel";
import {
  apiFetch,
  downloadPdf,
  fetchAuthenticatedBlob,
  printPdf,
} from "../lib/api";
import { getErrorMessage } from "../lib/api-error";
import {
  confirmAction,
  notifyError,
  notifySuccess,
  promptAction,
} from "../lib/app-notifications";

type Tab = "saida" | "entrada" | "cadastros" | "config" | "historico";

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
  fiscalInvoice: {
    id: string;
    status: FiscalInvoiceStatus;
    number: number | null;
  } | null;
};

/** Pedidos que podem entrar no lote: criar rascunho + transmitir, ou só transmitir draft. */
function isBatchEmitable(o: EligibleOrder): boolean {
  if (o.canEmit === true) return true;
  return o.fiscalInvoice?.status === "DRAFT";
}

function selectAllState(
  allSelected: boolean,
  someSelected: boolean,
): boolean | "indeterminate" {
  if (allSelected) return true;
  if (someSelected) return "indeterminate";
  return false;
}

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
  supplier?: { tradeName?: string; legalName?: string; cnpj?: string } | null;
  order?: { customer: { name: string } | null } | null;
  items: {
    id: string;
    description: string;
    quantity: unknown;
    productId: string | null;
  }[];
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
  logo?: {
    uploaded: boolean;
    mimeType?: string | null;
  };
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
  const [xmlFileName, setXmlFileName] = useState<string | null>(null);
  const [xmlDragActive, setXmlDragActive] = useState(false);
  const xmlFileInputRef = useRef<HTMLInputElement>(null);
  const xmlDragDepthRef = useRef(0);
  const [certPassword, setCertPassword] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [mappingInvoiceId, setMappingInvoiceId] = useState<string | null>(null);
  const [productMappings, setProductMappings] = useState<
    Record<string, string>
  >({});
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [batchEmitProgress, setBatchEmitProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["admin", "fiscal", "settings"],
    queryFn: () => apiFetch<FiscalSettings>("/admin/fiscal/settings"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products", "fiscal-map"],
    queryFn: () =>
      apiFetch<{ id: string; name: string; sku?: string | null }[]>(
        "/admin/products",
      ),
    enabled: tab === "entrada",
  });

  const { data: eligibleOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["admin", "fiscal", "outbound-orders"],
    queryFn: () => apiFetch<EligibleOrder[]>("/admin/fiscal/outbound/orders"),
    enabled: tab === "saida",
  });

  const batchableOrders = eligibleOrders.filter(isBatchEmitable);
  const batchableIds = batchableOrders.map((o) => o.id);
  const selectedBatchOrders = batchableOrders.filter((o) =>
    selectedOrderIds.has(o.id),
  );
  const hasOrderSelection = selectedBatchOrders.length > 0;
  const allBatchableSelected =
    batchableIds.length > 0 &&
    batchableIds.every((id) => selectedOrderIds.has(id));
  const someBatchableSelected =
    batchableIds.some((id) => selectedOrderIds.has(id)) &&
    !allBatchableSelected;
  const batchEmitBusy = batchEmitProgress != null;

  useEffect(() => {
    setSelectedOrderIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(eligibleOrders.map((o) => o.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (
          valid.has(id) &&
          eligibleOrders.some((o) => o.id === id && isBatchEmitable(o))
        ) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [eligibleOrders]);

  function toggleOrder(id: string, checked: boolean) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllBatchable(checked: boolean) {
    setSelectedOrderIds(checked ? new Set(batchableIds) : new Set());
  }

  async function emitAndTransmitOrder(order: EligibleOrder) {
    if (order.canEmit === true) {
      const invoice = await apiFetch<{ id: string }>(
        `/admin/fiscal/outbound/from-order/${order.id}`,
        { method: "POST" },
      );
      await apiFetch(`/admin/fiscal/outbound/invoices/${invoice.id}/transmit`, {
        method: "POST",
      });
      return;
    }
    if (order.fiscalInvoice?.status === "DRAFT") {
      await apiFetch(
        `/admin/fiscal/outbound/invoices/${order.fiscalInvoice.id}/transmit`,
        {
          method: "POST",
        },
      );
      return;
    }
    throw new Error("Pedido não elegível para emissão em lote.");
  }

  async function handleBatchEmit() {
    if (!hasOrderSelection || batchEmitBusy) return;

    const ok = await confirmAction({
      title: `Emitir NF-e de ${selectedBatchOrders.length} pedido(s)?`,
      message:
        "Para cada pedido selecionado: cria o rascunho (se ainda não houver) e transmite à SEFAZ. Falhas em um item não interrompem os demais.",
      confirmLabel: "Emitir em lote",
    });
    if (!ok) return;

    const targets = [...selectedBatchOrders];
    let success = 0;
    const failures: { label: string; error: string }[] = [];

    setBatchEmitProgress({ current: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        const order = targets[i]!;
        setBatchEmitProgress({ current: i + 1, total: targets.length });
        const label = order.customer?.name ?? order.id.slice(0, 8);
        try {
          await emitAndTransmitOrder(order);
          success += 1;
        } catch (e) {
          failures.push({ label, error: getErrorMessage(e) });
        }
      }
    } finally {
      setBatchEmitProgress(null);
      setSelectedOrderIds(new Set());
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    }

    if (failures.length === 0) {
      notifySuccess(
        `${success} NF-e transmitida(s) com sucesso.`,
        "Emissão em lote",
      );
    } else if (success === 0) {
      notifyError(
        failures.map((f) => `${f.label}: ${f.error}`).join("\n"),
        "Nenhuma NF-e emitida",
      );
    } else {
      notifyError(
        `${success} ok · ${failures.length} falha(s):\n` +
          failures.map((f) => `${f.label}: ${f.error}`).join("\n"),
        "Emissão em lote parcial",
      );
    }
  }

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
      apiFetch(`/admin/fiscal/outbound/from-order/${orderId}`, {
        method: "POST",
      }),
    onSuccess: () => {
      notifySuccess("NF-e em rascunho criada com sucesso.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  const transmit = useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch(`/admin/fiscal/outbound/invoices/${invoiceId}/transmit`, {
        method: "POST",
      }),
    onSuccess: () => {
      notifySuccess("NF-e transmitida para a SEFAZ.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  const cancelOutbound = useMutation({
    mutationFn: ({
      invoiceId,
      justification,
    }: {
      invoiceId: string;
      justification: string;
    }) =>
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
    mutationFn: ({
      invoiceId,
      justification,
    }: {
      invoiceId: string;
      justification: string;
    }) =>
      apiFetch(`/admin/fiscal/inbound/invoices/${invoiceId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ justification }),
      }),
    onSuccess: () => {
      notifySuccess("Cancelamento registrado.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  async function promptCancel(onConfirm: (justification: string) => void) {
    const justification = await promptAction({
      title: "Cancelar NF-e",
      message:
        "Informe a justificativa do cancelamento (mínimo 15 caracteres).",
      placeholder: "Motivo do cancelamento…",
      multiline: true,
      minLength: 15,
      confirmLabel: "Cancelar NF-e",
      variant: "destructive",
    });
    if (!justification) return;
    onConfirm(justification);
  }

  function canShowDanfe(status: FiscalInvoiceStatus) {
    return (
      status === "AUTHORIZED" || status === "IMPORTED" || status === "CANCELLED"
    );
  }

  async function handleDanfe(
    invoiceId: string,
    number: number | null,
    action: "download" | "print",
  ) {
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
      apiFetch<{ id: string }>("/admin/fiscal/inbound/import-xml", {
        method: "POST",
        body: JSON.stringify({ xml: xmlPaste }),
      }),
    onSuccess: (inv) => {
      setXmlPaste("");
      setXmlFileName(null);
      if (xmlFileInputRef.current) xmlFileInputRef.current.value = "";
      notifySuccess("NF-e de entrada importada com sucesso.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
      if (inv?.id) {
        setMappingInvoiceId(inv.id);
        setProductMappings({});
      }
    },
    onError: (e) => notifyError(getErrorMessage(e), "Falha ao importar NF-e"),
  });

  const syncDfe = useMutation({
    mutationFn: () =>
      apiFetch<{ message: string; imported?: number }>(
        "/admin/fiscal/inbound/sync",
        {
          method: "POST",
        },
      ),
    onSuccess: (res) => {
      notifySuccess(res.message ?? "Consulta DF-e concluída.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  const confirmImport = useMutation({
    mutationFn: () =>
      apiFetch(
        "/admin/fiscal/inbound/invoices/" +
          mappingInvoiceId +
          "/confirm-import",
        {
          method: "POST",
          body: JSON.stringify({ productMappings }),
        },
      ),
    onSuccess: () => {
      notifySuccess(
        "Importação confirmada (de-para e estoque, se configurado).",
      );
      setMappingInvoiceId(null);
      setProductMappings({});
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  const manifest = useMutation({
    mutationFn: ({
      accessKey,
      type,
    }: {
      accessKey: string;
      type: "CIENCIA" | "CONFIRMACAO" | "DESCONHECIMENTO" | "NAO_REALIZADA";
    }) =>
      apiFetch(`/admin/fiscal/inbound/${accessKey}/manifest`, {
        method: "POST",
        body: JSON.stringify({ type }),
      }),
    onSuccess: () => {
      notifySuccess("Manifestação enviada à SEFAZ.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal"] });
    },
  });

  async function loadXmlFromFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xml")) {
      notifyError("Selecione um arquivo com extensão .xml");
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        notifyError("O arquivo XML está vazio.");
        return;
      }
      setXmlPaste(text);
      setXmlFileName(file.name);
      notifySuccess(
        `Arquivo "${file.name}" carregado. Clique em Importar NF-e para concluir.`,
      );
    } catch {
      notifyError("Não foi possível ler o arquivo XML.");
    }
  }

  function onXmlDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    xmlDragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) setXmlDragActive(true);
  }

  function onXmlDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    xmlDragDepthRef.current -= 1;
    if (xmlDragDepthRef.current <= 0) {
      xmlDragDepthRef.current = 0;
      setXmlDragActive(false);
    }
  }

  function onXmlDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onXmlDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    xmlDragDepthRef.current = 0;
    setXmlDragActive(false);
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.name.toLowerCase().endsWith(".xml"),
    );
    if (!file) {
      notifyError("Solte um arquivo .xml");
      return;
    }
    void loadXmlFromFile(file);
  }

  const saveSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/admin/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      notifySuccess("Configurações fiscais salvas.");
      void refetchSettings();
    },
  });

  const uploadCert = useMutation({
    mutationFn: async () => {
      if (!certFile) throw new Error("Selecione o arquivo .pfx");
      const buf = await certFile.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const pfxBase64 = btoa(binary);
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

  const uploadLogo = useMutation({
    mutationFn: async () => {
      if (!logoFile) throw new Error("Selecione uma imagem");
      const buf = await logoFile.arrayBuffer();
      const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return apiFetch("/admin/fiscal/logo", {
        method: "POST",
        body: JSON.stringify({
          imageBase64,
          mimeType: logoFile.type || "image/png",
        }),
      });
    },
    onSuccess: () => {
      setLogoFile(null);
      notifySuccess(
        "Logo salva. Ela aparecerá nos DANFE gerados pelo sistema.",
      );
      void refetchSettings();
    },
    onError: (e) => notifyError(getErrorMessage(e), "Falha ao enviar logo"),
  });

  const removeLogo = useMutation({
    mutationFn: () => apiFetch("/admin/fiscal/logo", { method: "DELETE" }),
    onSuccess: () => {
      setLogoFile(null);
      notifySuccess("Logo removida.");
      void refetchSettings();
    },
    onError: (e) => notifyError(getErrorMessage(e), "Falha ao remover logo"),
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
    if (!settings?.logo?.uploaded) {
      setLogoPreview(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void fetchAuthenticatedBlob("/admin/fiscal/logo")
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLogoPreview(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setLogoPreview(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [settings?.logo?.uploaded, settings?.logo?.mimeType]);

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
    { id: "historico", label: "Histórico" },
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
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border"
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

            <div className="mb-3 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {hasOrderSelection
                  ? `${selectedBatchOrders.length} pedido(s) selecionado(s)`
                  : batchableIds.length > 0
                    ? "Selecione pedidos prontos para emitir ou transmitir NF-e em lote"
                    : "Nenhum pedido elegível para emissão em lote no momento"}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={!hasOrderSelection || batchEmitBusy}
                onClick={() => void handleBatchEmit()}
              >
                {batchEmitProgress
                  ? `Emitindo ${batchEmitProgress.current}/${batchEmitProgress.total}…`
                  : "Emitir NF-e em lote"}
              </Button>
            </div>

            {loadingOrders ? (
              <p className="text-muted-foreground">Carregando…</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-background text-left text-muted-foreground">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <Checkbox
                          checked={selectAllState(
                            allBatchableSelected,
                            someBatchableSelected,
                          )}
                          disabled={batchableIds.length === 0 || batchEmitBusy}
                          onCheckedChange={(v) =>
                            toggleAllBatchable(v === true)
                          }
                          aria-label="Selecionar todos os elegíveis"
                        />
                      </th>
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Vendedor</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">NF-e</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleOrders.map((o) => {
                      const batchable = isBatchEmitable(o);
                      const selected = selectedOrderIds.has(o.id);
                      return (
                        <tr
                          key={o.id}
                          className={cn(
                            "border-t border-border",
                            selected && "bg-muted/40",
                          )}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selected}
                              disabled={!batchable || batchEmitBusy}
                              onCheckedChange={(v) =>
                                toggleOrder(o.id, v === true)
                              }
                              aria-label={`Selecionar pedido ${o.id.slice(0, 8)}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {o.id.slice(0, 8)}…
                          </td>
                          <td className="px-4 py-3">
                            {o.customer?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3">{o.seller.user.name}</td>
                          <td className="px-4 py-3">
                            R$ {Number(o.totalAmount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            {o.fiscalStatus === "NONE"
                              ? "Sem nota"
                              : FISCAL_INVOICE_STATUS_LABELS[
                                  o.fiscalStatus as FiscalInvoiceStatus
                                ]}
                          </td>
                          <td className="px-4 py-3">
                            {o.fiscalStatus === "NONE" ||
                            o.fiscalStatus === "REJECTED" ? (
                              <div className="space-y-1">
                                {o.readinessIssues &&
                                  o.readinessIssues.length > 0 && (
                                    <p className="max-w-xs text-xs text-amber-600">
                                      {o.readinessIssues
                                        .map((i) => i.message)
                                        .join(" · ")}
                                    </p>
                                  )}
                                <Button
                                  size="sm"
                                  disabled={
                                    emitFromOrder.isPending ||
                                    o.canEmit === false ||
                                    batchEmitBusy
                                  }
                                  onClick={() => emitFromOrder.mutate(o.id)}
                                >
                                  Emitir NF-e
                                </Button>
                              </div>
                            ) : o.fiscalInvoice?.status === "DRAFT" ? (
                              <Button
                                size="sm"
                                disabled={transmit.isPending || batchEmitBusy}
                                onClick={() =>
                                  transmit.mutate(o.fiscalInvoice!.id)
                                }
                              >
                                Transmitir
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
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
                      <td className="px-4 py-3">
                        {inv.order?.customer?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {FISCAL_INVOICE_STATUS_LABELS[inv.status]}
                      </td>
                      <td className="px-4 py-3">
                        R$ {Number(inv.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {inv.accessKey?.slice(0, 12) ?? "—"}…
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canShowDanfe(inv.status) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void handleDanfe(
                                    inv.id,
                                    inv.number,
                                    "download",
                                  )
                                }
                              >
                                DANFE
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  void handleDanfe(inv.id, inv.number, "print")
                                }
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
                                  cancelOutbound.mutate({
                                    invoiceId: inv.id,
                                    justification,
                                  }),
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
          <FormSection title="Consultar SEFAZ (DF-e)">
            <p className="mb-3 text-sm text-muted-foreground">
              Busca notas emitidas contra o CNPJ da empresa (Distribuição DF-e).
              Requer certificado A1.
            </p>
            <Button
              disabled={syncDfe.isPending}
              onClick={() => syncDfe.mutate()}
            >
              {syncDfe.isPending ? "Consultando…" : "Consultar DF-e na SEFAZ"}
            </Button>
          </FormSection>

          <FormSection title="Importar XML manualmente">
            <p className="mb-3 text-sm text-muted-foreground">
              O padrão fiscal é o <strong>XML da NF-e</strong> (arquivo .xml),
              não o PDF do DANFE. Arraste o arquivo, selecione no computador ou
              cole o conteúdo — após importar, o sistema gera o DANFE no layout
              oficial.
            </p>

            <div
              role="button"
              tabIndex={0}
              aria-label="Área para arrastar ou selecionar arquivo XML da NF-e"
              className={cn(
                "mb-4 cursor-pointer rounded-xl border border-dashed p-6 text-center transition-colors",
                xmlDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/50 hover:bg-muted/30",
              )}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                xmlFileInputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  xmlFileInputRef.current?.click();
                }
              }}
              onDragEnter={onXmlDragEnter}
              onDragLeave={onXmlDragLeave}
              onDragOver={onXmlDragOver}
              onDrop={onXmlDrop}
            >
              <input
                ref={xmlFileInputRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void loadXmlFromFile(file);
                }}
              />
              <p className="text-sm font-medium">
                {xmlDragActive
                  ? "Solte o arquivo XML aqui"
                  : "Arraste o arquivo .xml para esta área"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">ou</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    xmlFileInputRef.current?.click();
                  }}
                >
                  Escolher arquivo…
                </Button>
                {xmlFileName ? (
                  <span className="text-sm text-muted-foreground">
                    Selecionado:{" "}
                    <span className="font-medium text-foreground">
                      {xmlFileName}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Nenhum arquivo selecionado
                  </span>
                )}
              </div>
            </div>

            <p className="mb-2 text-sm font-medium">Ou cole o XML abaixo</p>
            <textarea
              className={`${fieldControlClass} min-h-[120px] w-full font-mono text-xs`}
              placeholder="Cole o XML da NF-e de entrada aqui…"
              value={xmlPaste}
              onChange={(e) => {
                setXmlPaste(e.target.value);
                if (e.target.value.trim() && !xmlFileName) return;
                if (!e.target.value.trim()) {
                  setXmlFileName(null);
                  if (xmlFileInputRef.current)
                    xmlFileInputRef.current.value = "";
                }
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                disabled={importXml.isPending || !xmlPaste.trim()}
                onClick={() => importXml.mutate()}
              >
                {importXml.isPending ? "Importando…" : "Importar NF-e"}
              </Button>
              {xmlPaste.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={importXml.isPending}
                  onClick={() => {
                    setXmlPaste("");
                    setXmlFileName(null);
                    if (xmlFileInputRef.current)
                      xmlFileInputRef.current.value = "";
                  }}
                >
                  Limpar
                </Button>
              ) : null}
            </div>
            {settings?.autoStockOnInboundInvoice ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Estoque automático ativo — confirme o de-para dos produtos após
                importar.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Estoque automático desligado — apenas registro fiscal.
              </p>
            )}
          </FormSection>

          {mappingInvoiceId ? (
            <FormSection title="De-para de produtos (confirmação)">
              <p className="mb-3 text-sm text-muted-foreground">
                Vincule cada item da NF-e a um produto interno. Necessário para
                estoque automático.
              </p>
              {(
                inboundInvoices.find((i) => i.id === mappingInvoiceId)?.items ??
                []
              ).map((item) => (
                <div key={item.id} className="mb-3 grid gap-2 sm:grid-cols-2">
                  <div className="text-sm">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-muted-foreground">
                      Qtd: {String(item.quantity)}
                    </p>
                  </div>
                  <select
                    className={fieldControlClass}
                    value={productMappings[item.id] ?? item.productId ?? ""}
                    onChange={(e) =>
                      setProductMappings((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Sem vínculo</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.sku ? ` (${p.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={confirmImport.isPending}
                  onClick={() => confirmImport.mutate()}
                >
                  {confirmImport.isPending
                    ? "Confirmando…"
                    : "Confirmar importação"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setMappingInvoiceId(null)}
                >
                  Fechar
                </Button>
              </div>
            </FormSection>
          ) : null}

          <section>
            <h2 className="mb-3 text-lg font-medium">
              Notas de entrada registradas
            </h2>
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
                      <td className="px-4 py-3">
                        {inv.supplier?.tradeName ??
                          inv.supplier?.legalName ??
                          "—"}
                      </td>
                      <td className="px-4 py-3">
                        {inv.series}/{inv.number}
                      </td>
                      <td className="px-4 py-3">
                        R$ {Number(inv.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {inv.stockApplied ? "Aplicado" : "Não"}
                      </td>
                      <td className="px-4 py-3">
                        {FISCAL_INVOICE_STATUS_LABELS[inv.status]}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canShowDanfe(inv.status) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void handleDanfe(
                                    inv.id,
                                    inv.number,
                                    "download",
                                  )
                                }
                              >
                                DANFE
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  void handleDanfe(inv.id, inv.number, "print")
                                }
                              >
                                Imprimir
                              </Button>
                            </>
                          )}
                          {(inv.status === "IMPORTED" ||
                            inv.status === "AUTHORIZED") &&
                            !inv.stockApplied && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setMappingInvoiceId(inv.id);
                                  const initial: Record<string, string> = {};
                                  for (const it of inv.items) {
                                    if (it.productId)
                                      initial[it.id] = it.productId;
                                  }
                                  setProductMappings(initial);
                                }}
                              >
                                De-para
                              </Button>
                            )}
                          {inv.accessKey &&
                            (inv.status === "IMPORTED" ||
                              inv.status === "DRAFT") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={manifest.isPending}
                                onClick={() =>
                                  manifest.mutate({
                                    accessKey: inv.accessKey!,
                                    type: "CIENCIA",
                                  })
                                }
                              >
                                Ciência
                              </Button>
                            )}
                          {(inv.status === "IMPORTED" ||
                            inv.status === "AUTHORIZED") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={cancelInbound.isPending}
                              onClick={() =>
                                promptCancel((justification) =>
                                  cancelInbound.mutate({
                                    invoiceId: inv.id,
                                    justification,
                                  }),
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

      {tab === "historico" && (
        <div className="space-y-6">
          <div className="surface-card p-6">
            <AuditLogPanel
              title="Histórico de NF-e"
              entityType="FiscalInvoice"
              take={50}
            />
          </div>
          <div className="surface-card p-6">
            <AuditLogPanel
              title="Histórico de configuração fiscal"
              entityType="FiscalConfig"
              take={30}
            />
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="space-y-6">
          <FormSection title="Emitente">
            <FormGrid>
              <FormField label="CNPJ">
                <Input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                />
              </FormField>
              <FormField label="Inscrição estadual">
                <Input
                  value={form.stateRegistration}
                  onChange={(e) =>
                    setForm({ ...form, stateRegistration: e.target.value })
                  }
                />
              </FormField>
              <FormField label="UF">
                <Input
                  value={form.uf}
                  maxLength={2}
                  onChange={(e) => setForm({ ...form, uf: e.target.value })}
                />
              </FormField>
              <FormField label="Regime">
                <select
                  className={fieldControlClass}
                  value={form.taxRegime}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      taxRegime: e.target.value as FiscalTaxRegime,
                    })
                  }
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
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nfeEnvironment: e.target.value as NfeEnvironment,
                    })
                  }
                >
                  {Object.entries(NFE_ENVIRONMENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Série">
                <Input
                  value={form.nfeSeries}
                  onChange={(e) =>
                    setForm({ ...form, nfeSeries: e.target.value })
                  }
                />
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

          <FormSection title="Logo no DANFE">
            <p className="mb-3 text-sm text-muted-foreground">
              Imagem exibida no <strong>canto superior esquerdo</strong> do
              DANFE, em área dedicada apenas à logo da empresa. PNG ou JPEG
              recomendado (também aceita WebP e GIF). Tamanho máximo: 512 KB.
            </p>
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-2">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo da empresa"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-center text-xs text-muted-foreground">
                    Sem logo
                  </span>
                )}
              </div>
              <div className="flex min-w-[220px] flex-1 flex-col gap-3">
                <FormField label="Arquivo de imagem">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  />
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={uploadLogo.isPending || !logoFile}
                    onClick={() => uploadLogo.mutate()}
                  >
                    {uploadLogo.isPending ? "Enviando…" : "Salvar logo"}
                  </Button>
                  {settings?.logo?.uploaded ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive"
                      disabled={removeLogo.isPending}
                      onClick={() => removeLogo.mutate()}
                    >
                      Remover logo
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Certificado A1">
            {settings?.certificate?.uploaded && (
              <p
                className={`mb-3 text-sm ${settings.certificate.warning ? "text-amber-600" : "text-muted-foreground"}`}
              >
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
            <Button
              className="mt-3"
              disabled={uploadCert.isPending}
              onClick={() => uploadCert.mutate()}
            >
              Enviar certificado
            </Button>
          </FormSection>

          <FormSection title="Estoque na NF-e de entrada">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.autoStockOnInboundInvoice}
                onCheckedChange={(v) =>
                  setForm({
                    ...form,
                    autoStockOnInboundInvoice: v === true,
                  })
                }
              />
              Lançar estoque automaticamente ao confirmar importação de NF-e de
              entrada
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
