import {
  FormField,
  FormGrid,
  FormSection,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { useConfirm } from "@/components/confirm";
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
import type { CustomerFormValues, CustomerRecord } from "@pedidos/shared";
import {
  customerToForm,
  emptyCustomerForm,
  formToCustomerPayload,
  formatCnpjMask,
  formatCpfMask,
  validateCustomerForm,
} from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CustomerFormFields } from "../components/CustomerFormFields";
import { CustomerTitlesPanel } from "../components/CustomerTitlesPanel";
import { apiFetch } from "../lib/api";

type Seller = { id: string; user: { name: string } };

function customerHasMapCoords(c: CustomerRecord): boolean {
  return (
    c.latitude != null &&
    c.longitude != null &&
    String(c.latitude).trim() !== "" &&
    String(c.longitude).trim() !== ""
  );
}

function formatDocument(c: CustomerRecord): string {
  if (c.cnpj) return formatCnpjMask(c.cnpj);
  if (c.cpf) return formatCpfMask(c.cpf);
  return "—";
}

function formatCityUf(c: CustomerRecord): string {
  if (c.city && c.state) return `${c.city}/${c.state}`;
  if (c.state) return c.state;
  return "—";
}

export function CustomersPage() {
  const qc = useQueryClient();
  const { confirm, alert } = useConfirm();
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => apiFetch<CustomerRecord[]>("/admin/customers"),
  });
  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const { data: pricingSettings } = useQuery({
    queryKey: ["admin", "pricing-settings"],
    queryFn: () =>
      apiFetch<{
        defaultMaxSellerDiscountPercent: number;
        creditPolicy: string;
      }>("/admin/pricing-settings"),
  });

  const patchPricing = useMutation({
    mutationFn: (creditPolicy: string) =>
      apiFetch("/admin/pricing-settings", {
        method: "PATCH",
        body: JSON.stringify({ creditPolicy }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "pricing-settings"] }),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<CustomerFormValues>(emptyCustomerForm());
  const [showValidation, setShowValidation] = useState(false);
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [sellerId, setSellerId] = useState("");
  const [creditLimitStr, setCreditLimitStr] = useState("");
  const [creditBlockedEdit, setCreditBlockedEdit] = useState(false);
  const [geoLatStr, setGeoLatStr] = useState("");
  const [geoLngStr, setGeoLngStr] = useState("");

  function patchForm(patch: Partial<CustomerFormValues>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyCustomerForm());
    setShowValidation(false);
    setSellerId("");
    setCreditLimitStr("");
    setCreditBlockedEdit(false);
    setGeoLatStr("");
    setGeoLngStr("");
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(c: CustomerRecord) {
    setEditing(c);
    setForm(customerToForm(c));
    setSellerId(c.sellerId ?? "");
    setCreditBlockedEdit(Boolean(c.creditBlocked));
    setCreditLimitStr(
      c.creditLimit != null && c.creditLimit !== ""
        ? String(Number(c.creditLimit as string))
        : "",
    );
    setGeoLatStr(
      c.latitude != null && c.latitude !== ""
        ? String(Number(c.latitude as string))
        : "",
    );
    setGeoLngStr(
      c.longitude != null && c.longitude !== ""
        ? String(Number(c.longitude as string))
        : "",
    );
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  function parseGeo(): { latitude?: number | null; longitude?: number | null } {
    const lt = geoLatStr.trim();
    const lg = geoLngStr.trim();
    if (!lt && !lg) return { latitude: null, longitude: null };
    if (!lt || !lg)
      throw new Error("Informe latitude e longitude, ou deixe os dois vazios.");
    const latitude = Number(lt.replace(",", "."));
    const longitude = Number(lg.replace(",", "."));
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
      throw new Error("Latitude inválida.");
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
      throw new Error("Longitude inválida.");
    return { latitude, longitude };
  }

  const create = useMutation({
    mutationFn: () => {
      const geo = parseGeo();
      return apiFetch("/admin/customers", {
        method: "POST",
        body: JSON.stringify(
          formToCustomerPayload(form, {
            sellerId: sellerId || null,
            ...geo,
          }),
        ),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      closeSheet();
    },
    onError: (e: Error) => {
      void alert({
        title: "Não foi possível criar o cliente",
        description: e.message,
        tone: "danger",
      });
    },
  });

  const update = useMutation({
    mutationFn: () => {
      const geo = parseGeo();
      return apiFetch(`/admin/customers/${editing!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...formToCustomerPayload(form, {
            sellerId: sellerId || null,
            creditLimit:
              creditLimitStr.trim() === ""
                ? null
                : Number(creditLimitStr.replace(",", ".")),
            creditBlocked: creditBlockedEdit,
            ...geo,
          }),
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      closeSheet();
    },
    onError: (e: Error) => {
      void alert({
        title: "Não foi possível atualizar o cliente",
        description: e.message,
        tone: "danger",
      });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/customers/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] }),
  });

  const formErrors = useMemo(
    () => (showValidation ? validateCustomerForm(form) : {}),
    [form, showValidation],
  );

  function trySubmit() {
    const errors = validateCustomerForm(form);
    if (Object.keys(errors).length > 0) {
      setShowValidation(true);
      return;
    }
    if (editing) update.mutate();
    else create.mutate();
  }

  const savePending = editing ? update.isPending : create.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button type="button" onClick={openCreate}>
          Novo cliente
        </Button>
      </div>

      <FormSection
        title="Quando o cliente está “ruim” no crédito"
        description="Escolha se o app só avisa o vendedor, bloqueia o pedido ou envia para aprovação no escritório."
        className="border-sky-100 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/30"
      >
        <FormGrid cols={2}>
          <FormField
            label="Política da empresa"
            htmlFor="credit-policy"
            className="sm:col-span-2 max-w-md"
          >
            <AppSelect
              id="credit-policy"
              value={pricingSettings?.creditPolicy ?? "WARN_ONLY"}
              disabled={patchPricing.isPending || pricingSettings === undefined}
              options={[
                { value: "WARN_ONLY", label: "Só avisar (não bloqueia)" },
                { value: "BLOCK_ORDER", label: "Bloquear pedido" },
                {
                  value: "REQUIRE_APPROVAL",
                  label: "Pedir aprovação no escritório",
                },
              ]}
              onValueChange={(v) => patchPricing.mutate(v)}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title={editing ? "Editar cliente" : "Pré-cadastro de cliente"}
        description="Dados cadastrais completos, localização no mapa e, na edição, crédito."
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={trySubmit}
            submitLabel={editing ? "Salvar alterações" : "Cadastrar"}
            pending={savePending}
          />
        }
      >
        <CustomerFormFields
          values={form}
          onChange={patchForm}
          errors={formErrors}
          showCnpjLookup={!editing || form.documentType === "CNPJ"}
        />

        <FormGrid cols={2} className="mt-6">
          <FormField
            label="Vendedor"
            htmlFor="cust-seller"
            className="sm:col-span-2"
          >
            <AppSelect
              id="cust-seller"
              value={sellerId}
              emptyLabel="Opcional"
              placeholder="Opcional"
              options={sellers.map((s) => ({
                value: s.id,
                label: s.user.name,
              }))}
              onValueChange={setSellerId}
            />
          </FormField>
        </FormGrid>

        <div className="mt-4 rounded-lg border border-dashed border-border bg-background/90 p-4">
          <p className="text-xs font-semibold text-foreground">
            Localização no mapa (app do vendedor)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Latitude/longitude em graus decimais. Opcional; necessário para rota
            e «próximos».
          </p>
          <FormGrid cols={2} className="mt-3">
            <FormField label="Latitude" htmlFor="cust-lat">
              <Input
                id="cust-lat"
                placeholder="Ex.: -23.5505"
                value={geoLatStr}
                onChange={(e) => setGeoLatStr(e.target.value)}
                autoComplete="off"
              />
            </FormField>
            <FormField label="Longitude" htmlFor="cust-lng">
              <Input
                id="cust-lng"
                placeholder="Ex.: -46.6333"
                value={geoLngStr}
                onChange={(e) => setGeoLngStr(e.target.value)}
                autoComplete="off"
              />
            </FormField>
          </FormGrid>
        </div>

        {editing ? (
          <FormGrid
            cols={2}
            className="mt-4 rounded-lg border border-border bg-background/80 p-4"
          >
            <FormField
              label="Crédito"
              className="flex flex-row items-center gap-2 sm:col-span-2"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={creditBlockedEdit}
                  onChange={(e) => setCreditBlockedEdit(e.target.checked)}
                />
                Cliente bloqueado para vendas
              </label>
            </FormField>
            <FormField
              label="Limite de crédito (R$)"
              htmlFor="cust-credit-limit"
              hint="Vazio = sem limite"
            >
              <Input
                id="cust-credit-limit"
                placeholder="Sem limite"
                value={creditLimitStr}
                onChange={(e) => setCreditLimitStr(e.target.value)}
              />
            </FormField>
          </FormGrid>
        ) : null}

        {editing ? <CustomerTitlesPanel customerId={editing.id} /> : null}
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Nome</TableHead>
                <TableHead className="px-4">Documento</TableHead>
                <TableHead className="px-4">Cidade/UF</TableHead>
                <TableHead className="px-4">Telefone</TableHead>
                <TableHead className="px-4">Vendedor</TableHead>
                <TableHead className="px-4">Mapa</TableHead>
                <TableHead className="px-4">Crédito</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="px-4 py-3">{c.name}</TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs">
                    {formatDocument(c)}
                  </TableCell>
                  <TableCell className="px-4 py-3">{formatCityUf(c)}</TableCell>
                  <TableCell className="px-4 py-3">{c.phone ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3">
                    {(
                      c as CustomerRecord & {
                        seller?: { user: { name: string } };
                      }
                    ).seller?.user.name ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {customerHasMapCoords(c) ? (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Sim
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Não</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {c.creditBlocked ? (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                        Bloqueado
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-primary"
                      onClick={() => openEdit(c)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-destructive"
                      onClick={() => {
                        void confirm({
                          title: "Excluir cliente?",
                          description:
                            "O cliente será removido permanentemente do sistema.",
                          confirmLabel: "Excluir",
                          tone: "destructive",
                        }).then((ok) => {
                          if (ok) remove.mutate(c.id);
                        });
                      }}
                    >
                      Excluir
                    </button>
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
