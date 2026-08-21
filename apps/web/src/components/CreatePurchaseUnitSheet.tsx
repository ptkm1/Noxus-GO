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
import {
  canWrite,
  normalizePurchaseUnitCode,
  PURCHASE_UNIT_CODE_MAX,
} from "@pedidos/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export type CreatedPurchaseUnit = {
  id: string;
  code: string;
  name: string;
};

export type PurchaseUnitListItem = CreatedPurchaseUnit & {
  sortOrder?: number;
  isSystem?: boolean;
};

export function useCanCreatePurchaseUnit(): {
  allowed: boolean;
  reason: string | null;
} {
  const { user } = useAuth();
  const canCreate = Boolean(
    user && canWrite(user.role, "products", user.permissions),
  );

  if (!canCreate) {
    return {
      allowed: false,
      reason: "Você não tem permissão para criar unidades de compra.",
    };
  }
  return { allowed: true, reason: null };
}

type CreatePurchaseUnitSheetProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (unit: CreatedPurchaseUnit) => void;
}>;

export function CreatePurchaseUnitSheet({
  open,
  onOpenChange,
  onCreated,
}: CreatePurchaseUnitSheetProps) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  function resetForm() {
    setCode("");
    setName("");
    setShowValidation(false);
  }

  function close() {
    onOpenChange(false);
    resetForm();
  }

  const normalizedCode = normalizePurchaseUnitCode(code);

  const fieldErrors = useMemo(() => {
    if (!showValidation) return {} as Record<string, string>;
    const errors: Record<string, string> = {};
    if (!normalizedCode) errors.code = "Código é obrigatório.";
    if (!name.trim()) errors.name = "Nome é obrigatório.";
    return errors;
  }, [showValidation, normalizedCode, name]);

  useScrollToFirstError(fieldErrors, {
    enabled: showValidation && open,
  });

  const createUnit = useMutation({
    mutationFn: () =>
      apiFetch<CreatedPurchaseUnit>("/admin/purchase-units", {
        method: "POST",
        body: JSON.stringify({
          code: normalizedCode,
          name: name.trim(),
        }),
      }),
    onSuccess: async (created) => {
      qc.setQueryData<PurchaseUnitListItem[]>(
        ["admin", "purchase-units"],
        (old) => {
          if (!old) return [created];
          if (old.some((u) => u.id === created.id || u.code === created.code)) {
            return old;
          }
          return [created, ...old];
        },
      );
      await qc.invalidateQueries({ queryKey: ["admin", "purchase-units"] });
      onCreated(created);
      close();
    },
  });

  function tryCreate() {
    setShowValidation(true);
    if (!normalizedCode || !name.trim()) return;
    createUnit.mutate();
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
      title="Nova unidade"
      description="Código curto (ex.: PAL) e nome. A unidade será selecionada neste produto."
      footer={
        <FormSheetActions
          onCancel={close}
          onSubmit={tryCreate}
          submitLabel="Criar unidade"
          pending={createUnit.isPending}
        />
      }
    >
      <FormErrorBanner
        message={
          createUnit.error instanceof Error ? createUnit.error.message : null
        }
        className="mb-3"
      />
      <FormGrid cols={2}>
        <FormField
          label="Código"
          htmlFor="inline-pu-code"
          required
          error={fieldErrors.code}
          hint="Letras e números, até 10 caracteres."
        >
          <Input
            id="inline-pu-code"
            value={code}
            autoComplete="off"
            maxLength={PURCHASE_UNIT_CODE_MAX + 4}
            placeholder="PAL"
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tryCreate();
              }
            }}
          />
        </FormField>
        <FormField
          label="Nome"
          htmlFor="inline-pu-name"
          required
          error={fieldErrors.name}
        >
          <Input
            id="inline-pu-name"
            value={name}
            autoComplete="off"
            placeholder="Pallet"
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

type CreatePurchaseUnitButtonProps = Readonly<{
  onCreated: (unit: CreatedPurchaseUnit) => void;
}>;

export function CreatePurchaseUnitButton({
  onCreated,
}: CreatePurchaseUnitButtonProps) {
  const { allowed, reason } = useCanCreatePurchaseUnit();
  const [open, setOpen] = useState(false);

  return (
    <>
      <span className="inline-flex shrink-0" title={reason ?? undefined}>
        <Button
          type="button"
          variant="outline"
          disabled={!allowed}
          onClick={() => setOpen(true)}
        >
          Nova unidade
        </Button>
      </span>
      {reason ? <span className="sr-only">{reason}</span> : null}
      <CreatePurchaseUnitSheet
        open={open}
        onOpenChange={setOpen}
        onCreated={onCreated}
      />
    </>
  );
}

export function CreatePurchaseUnitHint() {
  const { allowed, reason } = useCanCreatePurchaseUnit();
  if (allowed || !reason) return null;
  return <p className="text-xs text-muted-foreground">{reason}</p>;
}
