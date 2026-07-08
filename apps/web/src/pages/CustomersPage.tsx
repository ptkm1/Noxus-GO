import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CnpjCompanyData } from "@pedidos/shared";
import { formatCnpjAddress, suggestedTradeName } from "@pedidos/shared";
import {
  FormField,
  FormGrid,
  FormSection,
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
import { apiFetch } from "../lib/api";
import { CnpjLookupField } from "../components/CnpjLookupField";
import { CustomerTitlesPanel } from "../components/CustomerTitlesPanel";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sellerId: string | null;
  seller?: { user: { name: string } } | null;
  creditLimit?: unknown;
  creditBlocked?: boolean;
  latitude?: unknown;
  longitude?: unknown;
  addressNote?: string | null;
};

type Seller = { id: string; user: { name: string } };

function customerHasMapCoords(c: Customer): boolean {
  return (
    c.latitude != null &&
    c.longitude != null &&
    String(c.latitude).trim() !== "" &&
    String(c.longitude).trim() !== ""
  );
}

export function CustomersPage() {
  const qc = useQueryClient();
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => apiFetch<Customer[]>("/admin/customers"),
  });
  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const { data: pricingSettings } = useQuery({
    queryKey: ["admin", "pricing-settings"],
    queryFn: () =>
      apiFetch<{ defaultMaxSellerDiscountPercent: number; creditPolicy: string }>(
        "/admin/pricing-settings",
      ),
  });

  const patchPricing = useMutation({
    mutationFn: (creditPolicy: string) =>
      apiFetch("/admin/pricing-settings", {
        method: "PATCH",
        body: JSON.stringify({ creditPolicy }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "pricing-settings"] }),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creditLimitStr, setCreditLimitStr] = useState("");
  const [creditBlockedEdit, setCreditBlockedEdit] = useState(false);
  const [geoLatStr, setGeoLatStr] = useState("");
  const [geoLngStr, setGeoLngStr] = useState("");
  const [geoNoteStr, setGeoNoteStr] = useState("");

  function resetForm() {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setSellerId("");
    setCreditLimitStr("");
    setCreditBlockedEdit(false);
    setGeoLatStr("");
    setGeoLngStr("");
    setGeoNoteStr("");
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setName(c.name);
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setSellerId(c.sellerId ?? "");
    setCreditBlockedEdit(Boolean(c.creditBlocked));
    setCreditLimitStr(
      c.creditLimit != null && c.creditLimit !== ""
        ? String(Number(c.creditLimit as string))
        : "",
    );
    setGeoLatStr(
      c.latitude != null && c.latitude !== "" ? String(Number(c.latitude as string)) : "",
    );
    setGeoLngStr(
      c.longitude != null && c.longitude !== "" ? String(Number(c.longitude as string)) : "",
    );
    setGeoNoteStr(c.addressNote ?? "");
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  const create = useMutation({
    mutationFn: () => {
      let latitude: number | undefined;
      let longitude: number | undefined;
      const lt = geoLatStr.trim();
      const lg = geoLngStr.trim();
      if (lt || lg) {
        if (!lt || !lg) throw new Error("Informe latitude e longitude, ou deixe os dois vazios.");
        latitude = Number(lt.replace(",", "."));
        longitude = Number(lg.replace(",", "."));
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Latitude inválida.");
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
          throw new Error("Longitude inválida.");
      }
      const note = geoNoteStr.trim();
      return apiFetch("/admin/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          sellerId: sellerId || undefined,
          ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
          ...(note ? { addressNote: note } : {}),
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      closeSheet();
    },
    onError: (e: Error) => window.alert(e.message),
  });

  const update = useMutation({
    mutationFn: () => {
      let latitude: number | null | undefined = undefined;
      let longitude: number | null | undefined = undefined;
      const lt = geoLatStr.trim();
      const lg = geoLngStr.trim();
      if (!lt && !lg) {
        latitude = null;
        longitude = null;
      } else {
        if (!lt || !lg) throw new Error("Latitude e longitude devem ficar ambas preenchidas, ou ambas vazias para limpar.");
        const la = Number(lt.replace(",", "."));
        const lo = Number(lg.replace(",", "."));
        if (!Number.isFinite(la) || la < -90 || la > 90) throw new Error("Latitude inválida.");
        if (!Number.isFinite(lo) || lo < -180 || lo > 180) throw new Error("Longitude inválida.");
        latitude = la;
        longitude = lo;
      }
      const noteTrim = geoNoteStr.trim();
      return apiFetch(`/admin/customers/${editing!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email: email || null,
          phone: phone || null,
          sellerId: sellerId || null,
          creditLimit:
            creditLimitStr.trim() === ""
              ? null
              : Number(creditLimitStr.replace(",", ".")),
          creditBlocked: creditBlockedEdit,
          latitude,
          longitude,
          addressNote: noteTrim === "" ? null : noteTrim,
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      closeSheet();
    },
    onError: (e: Error) => window.alert(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "customers"] }),
  });

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
          <FormField label="Política da empresa" htmlFor="credit-policy" className="sm:col-span-2 max-w-md">
            <AppSelect
              id="credit-policy"
              value={pricingSettings?.creditPolicy ?? "WARN_ONLY"}
              disabled={patchPricing.isPending || pricingSettings === undefined}
              options={[
                { value: "WARN_ONLY", label: "Só avisar (não bloqueia)" },
                { value: "BLOCK_ORDER", label: "Bloquear pedido" },
                { value: "REQUIRE_APPROVAL", label: "Pedir aprovação no escritório" },
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
        title={editing ? "Editar cliente" : "Novo cliente"}
        description="Dados cadastrais, localização no mapa e, na edição, crédito."
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={() => {
              if (editing) update.mutate();
              else create.mutate();
            }}
            submitLabel={editing ? "Salvar alterações" : "Cadastrar"}
            pending={savePending}
            disabled={!name}
          />
        }
      >
        {!editing ? (
          <CnpjLookupField
            buttonLabel="Buscar empresa (CNPJ)"
            onApply={(d: CnpjCompanyData) => {
              setName(suggestedTradeName(d));
              setEmail(d.email ?? "");
              setPhone(d.telefone ?? "");
              const address = formatCnpjAddress(d);
              if (address) setGeoNoteStr(address);
            }}
          />
        ) : null}
        <FormGrid cols={2} className="mt-4">
          <FormField label="Nome" htmlFor="cust-name" required className="sm:col-span-2">
            <Input
              id="cust-name"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Email" htmlFor="cust-email">
            <Input
              id="cust-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Telefone" htmlFor="cust-phone">
            <Input
              id="cust-phone"
              placeholder="Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>
          <FormField label="Vendedor" htmlFor="cust-seller" className="sm:col-span-2">
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
          <p className="text-xs font-semibold text-foreground">Localização no mapa (app do vendedor)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Latitude/longitude em graus decimais (ex.: −23.5505, −46.6333). Opcional; necessário para rota e «próximos».
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
            <FormField
              label="Nota de endereço"
              htmlFor="cust-geo-note"
              className="sm:col-span-2"
              hint="Como chegar (opcional)"
            >
              <Input
                id="cust-geo-note"
                placeholder="Referência ou instruções"
                value={geoNoteStr}
                onChange={(e) => setGeoNoteStr(e.target.value)}
                autoComplete="off"
              />
            </FormField>
          </FormGrid>
          {editing ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Para remover coordenadas, limpe latitude e longitude e guarde.
            </p>
          ) : null}
        </div>

        {editing ? (
          <FormGrid cols={2} className="mt-4 rounded-lg border border-border bg-background/80 p-4">
            <FormField label="Crédito" className="flex flex-row items-center gap-2 sm:col-span-2">
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
            <FormField label="Limite de crédito (R$)" htmlFor="cust-credit-limit" hint="Vazio = sem limite">
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
                <TableHead className="px-4">Email</TableHead>
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
                  <TableCell className="px-4 py-3">{c.email ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3">{c.phone ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3">{c.seller?.user.name ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3">
                    {customerHasMapCoords(c) ? (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary900">
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
                    <button type="button" className="text-primary" onClick={() => openEdit(c)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-destructive"
                      onClick={() => {
                        if (confirm("Excluir cliente?")) remove.mutate(c.id);
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
