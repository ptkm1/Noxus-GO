import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  apiFetch,
  downloadPdf,
  fetchAuthenticatedBlob,
  printPdf,
} from "@/lib/api";
import { formatOrderCode } from "@/lib/order-code";
import { cn } from "@/lib/utils";
import { expeditionSituationLabel } from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

type PickItem = {
  orderItemId: string;
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  requestedQty: number;
  checkedQty: number;
  lineStatus: "pending" | "partial" | "done";
};

type PickEvent = {
  id: string;
  type: string;
  createdAt: string;
  barcode: string | null;
  reason: string | null;
  qtyDelta: number;
  user: { name: string };
};

type ScanMatch = {
  orderItemId: string;
  productId: string;
  productName: string;
  barcode: string | null;
  sku?: string | null;
  requestedQty: number;
  checkedQty: number;
  remainingQty: number;
};

type PickDetail = {
  id: string;
  status: string;
  orderNumber?: number | null;
  createdAt: string;
  locked: boolean;
  customer: {
    name: string;
    tradeName?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  situation: { code: string; name: string } | null;
  expedition: {
    id: string;
    status: string;
    volumeQty: number;
    startedBy: { name: string } | null;
    finishedBy: { name: string } | null;
    finishedAt: string | null;
    events?: PickEvent[];
  } | null;
  items: PickItem[];
  progress: {
    requestedUnits: number;
    checkedUnits: number;
    percent: number;
    complete: boolean;
  };
  scanMatch?: ScanMatch;
};

type ApiErr = { message?: string; code?: string };

function customerName(d: PickDetail) {
  return d.customer?.tradeName?.trim() || d.customer?.name || "—";
}

function lineClass(status: PickItem["lineStatus"]) {
  if (status === "done") return "bg-emerald-500/10";
  if (status === "partial") return "bg-amber-500/10";
  return "";
}

function eventLabel(type: string) {
  switch (type) {
    case "START":
      return "Início da separação";
    case "SCAN":
      return "Bipagem";
    case "MANUAL_INC":
      return "Ajuste +1";
    case "MANUAL_DEC":
      return "Ajuste −1";
    case "COMPLETE":
      return "Separação finalizada";
    case "LABEL_PRINT":
      return "Impressão de etiqueta";
    case "REJECT_UNKNOWN":
      return "Código não encontrado";
    case "REJECT_WRONG":
      return "Produto fora do pedido";
    case "REJECT_OVER":
      return "Quantidade excedente";
    default:
      return type;
  }
}

export function ExpeditionPickPage() {
  const { orderId = "" } = useParams();
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState("");
  const [pending, setPending] = useState<ScanMatch | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [volumesDraft, setVolumesDraft] = useState<string | null>(null);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const autoStartRef = useRef(false);

  const q = useQuery({
    queryKey: ["admin", "expedition", "order", orderId],
    queryFn: () => apiFetch<PickDetail>(`/admin/expedition/orders/${orderId}`),
    enabled: Boolean(orderId),
  });

  const detail = q.data;
  const volumes = volumesDraft ?? String(detail?.expedition?.volumeQty ?? 1);

  useEffect(() => {
    return () => {
      if (labelUrl) URL.revokeObjectURL(labelUrl);
    };
  }, [labelUrl]);

  function focusScan() {
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }

  function focusQty() {
    window.setTimeout(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }, 30);
  }

  function showFlash(kind: "ok" | "err", message: string) {
    setFlash(kind);
    setFlashMsg(message);
    window.setTimeout(() => {
      setFlash(null);
      setFlashMsg(null);
    }, 2200);
  }

  const start = useMutation({
    mutationFn: () =>
      apiFetch<PickDetail>(`/admin/expedition/orders/${orderId}/start`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      void qc.setQueryData(["admin", "expedition", "order", orderId], data);
      focusScan();
    },
    onError: (e: ApiErr) => showFlash("err", e.message ?? "Falha ao iniciar"),
  });

  useEffect(() => {
    if (!detail || autoStartRef.current || detail.expedition) return;
    if (detail.status !== "CONFIRMED") return;
    autoStartRef.current = true;
    start.mutate();
  }, [detail, start]);

  useEffect(() => {
    if (
      detail?.expedition &&
      detail.expedition.status !== "COMPLETED" &&
      !adjusting &&
      !pending
    ) {
      focusScan();
    }
  }, [detail?.expedition, detail?.progress.checkedUnits, adjusting, pending]);

  const scan = useMutation({
    mutationFn: (code: string) =>
      apiFetch<PickDetail>(`/admin/expedition/orders/${orderId}/scan`, {
        method: "POST",
        body: JSON.stringify({ barcode: code }),
      }),
    onSuccess: (data) => {
      void qc.setQueryData(["admin", "expedition", "order", orderId], data);
      setBarcode("");
      if (data.scanMatch) {
        setPending(data.scanMatch);
        setQtyInput(String(data.scanMatch.remainingQty));
        showFlash("ok", data.scanMatch.productName);
        focusQty();
        return;
      }
      focusScan();
    },
    onError: (e: ApiErr) => {
      showFlash("err", e.message ?? "Falha na leitura");
      setBarcode("");
      setPending(null);
      focusScan();
    },
  });

  const confirmQty = useMutation({
    mutationFn: (body: {
      orderItemId: string;
      qty: number;
      barcode?: string;
    }) =>
      apiFetch<PickDetail>(`/admin/expedition/orders/${orderId}/scan`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      void qc.setQueryData(["admin", "expedition", "order", orderId], data);
      setPending(null);
      setQtyInput("");
      showFlash("ok", "Quantidade conferida");
      focusScan();
    },
    onError: (e: ApiErr) => {
      showFlash("err", e.message ?? "Falha ao conferir quantidade");
      focusQty();
    },
  });

  const adjust = useMutation({
    mutationFn: (body: {
      orderItemId: string;
      delta: 1 | -1;
      reason: string;
    }) =>
      apiFetch<PickDetail>(`/admin/expedition/orders/${orderId}/adjust`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      void qc.setQueryData(["admin", "expedition", "order", orderId], data);
      setAdjusting(null);
      setReason("");
      focusScan();
    },
    onError: (e: ApiErr) => showFlash("err", e.message ?? "Falha no ajuste"),
  });

  const complete = useMutation({
    mutationFn: () =>
      apiFetch<PickDetail>(`/admin/expedition/orders/${orderId}/complete`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      void qc.setQueryData(["admin", "expedition", "order", orderId], data);
      showFlash("ok", "Pedido conferido — 100%");
    },
    onError: (e: ApiErr) => showFlash("err", e.message ?? "Falha ao finalizar"),
  });

  const saveVolumes = useMutation({
    mutationFn: (volumeQty: number) =>
      apiFetch<PickDetail>(`/admin/expedition/orders/${orderId}/volumes`, {
        method: "PATCH",
        body: JSON.stringify({ volumeQty }),
      }),
    onSuccess: (data) => {
      void qc.setQueryData(["admin", "expedition", "order", orderId], data);
      setVolumesDraft(null);
    },
  });

  const ship = useMutation({
    mutationFn: () =>
      apiFetch<PickDetail>(`/admin/expedition/orders/${orderId}/ship`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      void qc.setQueryData(["admin", "expedition", "order", orderId], data);
    },
  });

  async function onScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = barcode.trim();
    if (!code || scan.isPending || confirmQty.isPending || detail?.locked)
      return;
    scan.mutate(code);
  }

  function onQtySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pending || confirmQty.isPending) return;
    const raw = qtyInput.trim();
    if (raw.length >= 8) {
      setPending(null);
      setQtyInput("");
      scan.mutate(raw);
      return;
    }
    const qty = Number(raw);
    if (!Number.isInteger(qty) || qty < 1) {
      showFlash("err", "Informe a quantidade conferida.");
      focusQty();
      return;
    }
    if (qty > pending.remainingQty) {
      showFlash(
        "err",
        "Quantidade já conferida. Este produto não possui mais unidades pendentes.",
      );
      setQtyInput(String(pending.remainingQty));
      focusQty();
      return;
    }
    confirmQty.mutate({
      orderItemId: pending.orderItemId,
      qty,
      barcode: pending.barcode ?? undefined,
    });
  }

  async function onFinish() {
    const ok = await confirm({
      title: "Finalizar separação?",
      description:
        "Todos os produtos deste pedido foram conferidos. Deseja finalizar a separação?",
      confirmLabel: "Finalizar",
    });
    if (ok) complete.mutate();
  }

  async function openLabel(volume: number, print: boolean) {
    const path = `/admin/expedition/orders/${orderId}/label.pdf?volume=${volume}&widthMm=100&heightMm=150`;
    if (print) {
      await printPdf(path);
      return;
    }
    const blob = await fetchAuthenticatedBlob(path);
    if (labelUrl) URL.revokeObjectURL(labelUrl);
    setLabelUrl(URL.createObjectURL(blob));
  }

  if (q.isLoading) {
    return <p className="text-muted-foreground">Carregando pedido…</p>;
  }
  if (!detail) {
    return (
      <p className="text-destructive">
        Pedido não encontrado.{" "}
        <Link to="/expedicao" className="underline">
          Voltar
        </Link>
      </p>
    );
  }

  const started = Boolean(detail.expedition);
  const packed = detail.expedition?.status === "COMPLETED";
  const canFinish = started && detail.progress.complete && !packed;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/expedicao" className="hover:underline">
              Expedição
            </Link>{" "}
            › Pedido
          </p>
          <h1 className="text-2xl font-semibold tabular-nums">
            PEDIDO Nº {formatOrderCode(detail)}
          </h1>
          <p className="mt-1 text-sm">
            Cliente: <strong>{customerName(detail)}</strong>
            {" · "}
            Cidade:{" "}
            <strong>
              {[detail.customer?.city, detail.customer?.state]
                .filter(Boolean)
                .join("/") || "—"}
            </strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Produtos: {detail.items.length} · Unidades:{" "}
            {detail.progress.requestedUnits} ·{" "}
            {expeditionSituationLabel(detail.situation?.code)}
          </p>
        </div>
        {!started ? (
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            Iniciar separação
          </Button>
        ) : null}
      </div>

      {flashMsg ? (
        <div
          className={cn(
            "rounded-md px-4 py-3 text-sm font-medium",
            flash === "ok"
              ? "bg-emerald-600 text-white"
              : "bg-destructive text-destructive-foreground",
          )}
        >
          {flashMsg}
        </div>
      ) : null}

      {started ? (
        <div className="surface-card space-y-4 p-4">
          <form onSubmit={(e) => void onScanSubmit(e)}>
            <label htmlFor="exp-scan" className="text-sm font-semibold">
              Código de barras
            </label>
            <Input
              id="exp-scan"
              ref={inputRef}
              autoFocus
              autoComplete="off"
              disabled={packed || scan.isPending || confirmQty.isPending}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Bipe o produto e pressione Enter"
              className="mt-2 h-12 text-lg"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              A pistola USB funciona como teclado: o código entra neste campo e
              o Enter identifica o produto.
            </p>
          </form>

          {pending ? (
            <form
              onSubmit={(e) => void onQtySubmit(e)}
              className="rounded-md border border-primary/30 bg-primary/5 p-4"
            >
              <p className="text-sm font-semibold">{pending.productName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Solicitado: {pending.requestedQty} · Já conferido:{" "}
                {pending.checkedQty} · Pendente: {pending.remainingQty}
              </p>
              <label
                htmlFor="exp-qty"
                className="mt-3 block text-sm font-semibold"
              >
                Quantidade desta leitura
              </label>
              <Input
                id="exp-qty"
                ref={qtyRef}
                autoComplete="off"
                inputMode="numeric"
                disabled={confirmQty.isPending}
                value={qtyInput}
                onChange={(e) =>
                  setQtyInput(e.target.value.replace(/[^\d]/g, ""))
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setPending(null);
                    setQtyInput("");
                    focusScan();
                  }
                }}
                className="mt-2 h-14 text-center text-2xl font-semibold tabular-nums"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="submit" disabled={confirmQty.isPending}>
                  Confirmar quantidade
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPending(null);
                    setQtyInput("");
                    focusScan();
                  }}
                >
                  Cancelar
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Digite a quantidade e pressione Enter. O valor já vem com o
                restante pendente.
              </p>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            Conferência do pedido: {detail.progress.percent}%
            {detail.progress.complete ? " — PEDIDO CONFERIDO" : ""}
          </p>
          {detail.progress.complete ? (
            <CheckCircle2 className="size-5 text-emerald-600" />
          ) : null}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${detail.progress.percent}%` }}
          />
        </div>
      </div>

      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-2">Produto</th>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2 text-right">Solicitada</th>
              <th className="px-4 py-2 text-right">Conferida</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {detail.items.map((it) => (
              <tr
                key={it.orderItemId}
                className={cn(
                  "border-b",
                  lineClass(it.lineStatus),
                  pending?.orderItemId === it.orderItemId &&
                    "ring-2 ring-inset ring-primary",
                )}
              >
                <td className="px-4 py-3 font-medium">{it.productName}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {it.barcode || it.sku || "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {it.requestedQty}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {it.checkedQty}/{it.requestedQty}
                </td>
                <td className="px-4 py-3">
                  {it.lineStatus === "done"
                    ? "Conferido"
                    : it.lineStatus === "partial"
                      ? "Parcial"
                      : "Pendente"}
                </td>
                <td className="px-4 py-3 text-right">
                  {started && !packed ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAdjusting(it.orderItemId)}
                      >
                        ±
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjusting ? (
        <div className="surface-card space-y-3 p-4">
          <p className="text-sm font-semibold">Ajuste manual (rastreável)</p>
          <Input
            placeholder="Motivo do ajuste"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={adjust.isPending || reason.trim().length < 3}
              onClick={() =>
                adjust.mutate({
                  orderItemId: adjusting,
                  delta: -1,
                  reason: reason.trim(),
                })
              }
            >
              −1
            </Button>
            <Button
              type="button"
              disabled={adjust.isPending || reason.trim().length < 3}
              onClick={() =>
                adjust.mutate({
                  orderItemId: adjusting,
                  delta: 1,
                  reason: reason.trim(),
                })
              }
            >
              +1
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAdjusting(null);
                setReason("");
                focusScan();
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={!canFinish || complete.isPending}
          onClick={() => void onFinish()}
        >
          Finalizar separação
        </Button>
        {packed ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              Volumes
              <Input
                className="w-20"
                type="number"
                min={1}
                max={99}
                value={volumes}
                onChange={(e) => setVolumesDraft(e.target.value)}
                onBlur={() => {
                  const n = Number(volumes);
                  if (n >= 1) saveVolumes.mutate(n);
                }}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => void openLabel(1, false)}
            >
              Gerar etiqueta
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void openLabel(1, true)}
            >
              <Printer className="size-4" />
              Imprimir etiqueta
            </Button>
            {Number(volumes) > 1
              ? Array.from({ length: Number(volumes) }, (_, i) => (
                  <Button
                    key={i}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void openLabel(i + 1, true)}
                  >
                    Vol. {i + 1}/{volumes}
                  </Button>
                ))
              : null}
            {detail.situation?.code !== "SENT" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => ship.mutate()}
                disabled={ship.isPending}
              >
                Marcar expedido
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {packed && detail.expedition?.finishedBy ? (
        <p className="text-xs text-muted-foreground">
          Finalizado por {detail.expedition.finishedBy.name}
          {detail.expedition.finishedAt
            ? ` em ${new Date(detail.expedition.finishedAt).toLocaleString("pt-BR")}`
            : ""}
        </p>
      ) : null}

      {detail.expedition?.events && detail.expedition.events.length > 0 ? (
        <div className="surface-card p-4">
          <p className="mb-2 text-sm font-semibold">Histórico da conferência</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {detail.expedition.events.map((ev) => (
              <li key={ev.id}>
                {new Date(ev.createdAt).toLocaleString("pt-BR")} ·{" "}
                {ev.user.name} · {eventLabel(ev.type)}
                {ev.barcode ? ` · ${ev.barcode}` : ""}
                {ev.reason ? ` · ${ev.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {labelUrl ? (
        <div className="surface-card space-y-2 p-4">
          <div className="flex justify-between gap-2">
            <p className="text-sm font-semibold">
              Pré-visualização da etiqueta
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void downloadPdf(
                  `/admin/expedition/orders/${orderId}/label.pdf?volume=1&widthMm=100&heightMm=150`,
                  "etiqueta-expedicao.pdf",
                )
              }
            >
              <Download className="size-4" />
              Baixar
            </Button>
          </div>
          <iframe
            title="Etiqueta"
            src={labelUrl}
            className="h-[420px] w-full max-w-sm rounded-md border bg-white"
          />
        </div>
      ) : null}
    </div>
  );
}
