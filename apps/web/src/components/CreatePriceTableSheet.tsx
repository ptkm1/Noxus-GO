import { useAuth } from "@/auth/AuthContext";
import {
  FormErrorBanner,
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScrollToFirstError } from "@/hooks/useScrollToFirstError";
import { apiFetch } from "@/lib/api";
import { canWrite, planHasFeature } from "@pedidos/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export type CreatedPriceTable = {
  id: string;
  name: string;
};

type PriceTableListItem = {
  id: string;
  name: string;
};

export function useCanCreatePriceTable(): {
  allowed: boolean;
  reason: string | null;
} {
  const { user } = useAuth();
  const hasFeature = user?.subscription?.features?.length
    ? user.subscription.features.includes("price_tables")
    : planHasFeature(user?.subscription?.planId, "price_tables");
  const canCreate = Boolean(
    user && canWrite(user.role, "price_tables", user.permissions),
  );

  if (!hasFeature) {
    return {
      allowed: false,
      reason: "Tabelas de preço não estão inclusas no seu plano.",
    };
  }
  if (!canCreate) {
    return {
      allowed: false,
      reason: "Você não tem permissão para criar tabelas de preço.",
    };
  }
  return { allowed: true, reason: null };
}

type CreatePriceTableSheetProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (table: CreatedPriceTable) => void;
}>;

export function CreatePriceTableSheet({
  open,
  onOpenChange,
  onCreated,
}: CreatePriceTableSheetProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  function resetForm() {
    setName("");
    setShowValidation(false);
  }

  function close() {
    onOpenChange(false);
    resetForm();
  }

  const fieldErrors = useMemo(() => {
    if (!showValidation) return {} as Record<string, string>;
    return !name.trim() ? { name: "Nome é obrigatório." } : {};
  }, [showValidation, name]);

  useScrollToFirstError(fieldErrors, {
    enabled: showValidation && open,
  });

  const createTable = useMutation({
    mutationFn: () =>
      apiFetch<CreatedPriceTable>("/admin/price-tables", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      }),
    onSuccess: async (created) => {
      qc.setQueryData<PriceTableListItem[]>(
        ["admin", "price-tables"],
        (old) => {
          const next = { id: created.id, name: created.name };
          if (!old) return [next];
          if (old.some((t) => t.id === created.id)) return old;
          return [next, ...old];
        },
      );
      await qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      onCreated(created);
      close();
    },
  });

  function tryCreate() {
    setShowValidation(true);
    if (!name.trim()) return;
    createTable.mutate();
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
      title="Nova tabela"
      description="Informe o nome. A tabela será selecionada neste produto."
      footer={
        <FormSheetActions
          onCancel={close}
          onSubmit={tryCreate}
          submitLabel="Criar tabela"
          pending={createTable.isPending}
        />
      }
    >
      <FormErrorBanner
        message={
          createTable.error instanceof Error ? createTable.error.message : null
        }
        className="mb-3"
      />
      <FormGrid cols={1}>
        <FormField
          label="Nome"
          htmlFor="inline-pt-name"
          required
          error={fieldErrors.name}
        >
          <Input
            id="inline-pt-name"
            value={name}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tryCreate();
              }
            }}
          />
        </FormField>
      </FormGrid>
    </FormSheet>
  );
}

type CreatePriceTableButtonProps = Readonly<{
  onCreated: (table: CreatedPriceTable) => void;
}>;

export function CreatePriceTableButton({
  onCreated,
}: CreatePriceTableButtonProps) {
  const { allowed, reason } = useCanCreatePriceTable();
  const [open, setOpen] = useState(false);

  return (
    <div className="inline-flex shrink-0">
      <span title={reason ?? undefined} className="inline-flex">
        <Button
          type="button"
          variant="outline"
          disabled={!allowed}
          onClick={() => setOpen(true)}
        >
          Nova tabela
        </Button>
      </span>
      {reason ? <span className="sr-only">{reason}</span> : null}
      <CreatePriceTableSheet
        open={open}
        onOpenChange={setOpen}
        onCreated={onCreated}
      />
    </div>
  );
}

export function CreatePriceTableHint() {
  const { allowed, reason } = useCanCreatePriceTable();
  if (allowed || !reason) return null;
  return <p className="text-xs text-muted-foreground">{reason}</p>;
}
