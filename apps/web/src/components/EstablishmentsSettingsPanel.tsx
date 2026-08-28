import { FormField, FormGrid, FormSection } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatCnpjShort,
  type EstablishmentListItem,
} from "@/auth/EstablishmentContext";
import { apiFetch } from "@/lib/api";
import { cnpjDigitsOnly, isValidCnpj, planHasFeature } from "@pedidos/shared";
import { useAuth } from "@/auth/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EstablishmentFiscalConfigSheet } from "@/components/EstablishmentFiscalConfigSheet";
import { Building2, Plus, Settings2 } from "lucide-react";
import { useState } from "react";

type ListResponse = {
  items: EstablishmentListItem[];
  preferredEstablishmentId: string | null;
};

function formatCnpjInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function EstablishmentsSettingsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canMulti = planHasFeature(user?.subscription?.planId, "multi_cnpj");
  const [showForm, setShowForm] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [uf, setUf] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [configEstablishmentId, setConfigEstablishmentId] = useState<
    string | null
  >(null);

  const listQ = useQuery({
    queryKey: ["admin", "establishments"],
    queryFn: () => apiFetch<ListResponse>("/admin/establishments"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      apiFetch("/admin/establishments", {
        method: "POST",
        body: JSON.stringify({
          legalName: legalName.trim(),
          tradeName: tradeName.trim() || undefined,
          cnpj: cnpjDigitsOnly(cnpj),
          uf: uf.trim().toUpperCase() || undefined,
        }),
      }),
    onSuccess: () => {
      setShowForm(false);
      setLegalName("");
      setTradeName("");
      setCnpj("");
      setUf("");
      setFormError(null);
      void qc.invalidateQueries({ queryKey: ["admin", "establishments"] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Falha ao cadastrar estabelecimento";
      setFormError(msg);
    },
  });

  const items = listQ.data?.items ?? [];

  return (
    <FormSection
      title="Estabelecimentos (CNPJs)"
      description="Uma conta, vários CNPJs. Estoque e clientes são compartilhados; NF-e e numeração são por estabelecimento."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length} cadastrado{items.length === 1 ? "" : "s"}
          {!canMulti && items.length >= 1
            ? " · Plano Business para adicionar mais CNPJs"
            : null}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canMulti && items.length >= 1}
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Adicionar CNPJ
        </Button>
      </div>

      <ul className="space-y-2">
        {items.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <div className="flex min-w-0 items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">
                  {e.tradeName || e.legalName}
                </div>
                <div className="text-muted-foreground">
                  {formatCnpjShort(e.cnpj)}
                  {e.uf ? ` · ${e.uf}` : ""}
                  {` · série NF-e ${e.nfeSeries} (último ${e.nfeLastNumber})`}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Configurar fiscal de ${e.tradeName || e.legalName}`}
                onClick={() => setConfigEstablishmentId(e.id)}
              >
                <Settings2 className="mr-1 h-4 w-4" />
                Configurar
              </Button>
              {e.isPrimary ? <Badge variant="secondary">Principal</Badge> : null}
              {!e.active ? <Badge variant="outline">Inativo</Badge> : null}
            </div>
          </li>
        ))}
      </ul>

      {showForm ? (
        <div className="mt-4 space-y-3 rounded-md border border-dashed border-border p-3">
          <FormGrid>
            <FormField label="Razão social" required>
              <Input
                value={legalName}
                onChange={(ev) => setLegalName(ev.target.value)}
              />
            </FormField>
            <FormField label="Nome fantasia">
              <Input
                value={tradeName}
                onChange={(ev) => setTradeName(ev.target.value)}
              />
            </FormField>
            <FormField label="CNPJ" required>
              <Input
                value={cnpj}
                onChange={(ev) => setCnpj(formatCnpjInput(ev.target.value))}
                inputMode="numeric"
              />
            </FormField>
            <FormField label="UF">
              <Input
                value={uf}
                maxLength={2}
                onChange={(ev) => setUf(ev.target.value.toUpperCase())}
              />
            </FormField>
          </FormGrid>
          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={
                createMut.isPending ||
                !legalName.trim() ||
                !isValidCnpj(cnpjDigitsOnly(cnpj))
              }
              onClick={() => {
                setFormError(null);
                createMut.mutate();
              }}
            >
              Salvar estabelecimento
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {items.length > 1 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Troque o CNPJ ativo no header. Pedidos novos usam o CNPJ ativo; a NF-e
          sempre usa o estabelecimento gravado no pedido.
        </p>
      ) : null}

      <EstablishmentFiscalConfigSheet
        establishmentId={configEstablishmentId}
        establishmentLabel={
          configEstablishmentId
            ? items.find((e) => e.id === configEstablishmentId)?.tradeName ||
              items.find((e) => e.id === configEstablishmentId)?.legalName
            : undefined
        }
        open={Boolean(configEstablishmentId)}
        onOpenChange={(open) => {
          if (!open) setConfigEstablishmentId(null);
        }}
      />
    </FormSection>
  );
}
