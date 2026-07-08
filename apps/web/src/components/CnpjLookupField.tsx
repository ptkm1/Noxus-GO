import type { CnpjCompanyData } from "@pedidos/shared";
import {
  cnpjDigitsOnly,
  formatCnpjMask,
  isCnpjComplete,
  isCnpjSituacaoAtiva,
  isValidCnpj,
  suggestedTradeName,
} from "@pedidos/shared";
import { useCallback, useState } from "react";
import { FormField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "../lib/api";

type Props = {
  onApply: (data: CnpjCompanyData) => void;
  disabled?: boolean;
  buttonLabel?: string;
};

export function CnpjLookupField({
  onApply,
  disabled,
  buttonLabel = "Buscar na Receita",
}: Props) {
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [situacaoWarning, setSituacaoWarning] = useState<string | null>(null);

  const lookup = useCallback(async () => {
    const d = cnpjDigitsOnly(digits);
    setHint(null);
    setLastOk(null);
    setSituacaoWarning(null);
    if (d.length !== 14) {
      setHint("Informe os 14 dígitos do CNPJ.");
      return;
    }
    if (!isValidCnpj(d)) {
      setHint("CNPJ inválido (dígitos verificadores incorretos).");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<CnpjCompanyData>(`/integrations/cnpj/${d}`, {
        skipAuth: true,
      });
      onApply(data);
      const trade = suggestedTradeName(data);
      setLastOk(
        `${trade}${data.situacaoCadastral ? ` · ${data.situacaoCadastral}` : ""}`,
      );
      if (!isCnpjSituacaoAtiva(data.situacaoCadastral)) {
        setSituacaoWarning(
          `Atenção: situação cadastral «${data.situacaoCadastral}» — confira na Receita Federal antes de prosseguir.`,
        );
      }
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setLoading(false);
    }
  }, [digits, onApply]);

  return (
    <FormField
      label="CNPJ (opcional)"
      htmlFor="cnpj-lookup"
      hint={
        <>
          Consulta pública via{" "}
          <a
            href="https://brasilapi.com.br/"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            BrasilAPI
          </a>
          . Os dados podem estar desatualizados — confira sempre na Receita Federal.
        </>
      }
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
        <Input
          id="cnpj-lookup"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0001-00"
          disabled={disabled || loading}
          className="font-mono"
          value={formatCnpjMask(digits)}
          onChange={(e) => setDigits(cnpjDigitsOnly(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void lookup();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={
            disabled || loading || !isCnpjComplete(digits) || !isValidCnpj(digits)
          }
          onClick={() => void lookup()}
        >
          {loading ? "A consultar…" : buttonLabel}
        </Button>
      </div>
      {hint ? <p className="text-sm text-destructive">{hint}</p> : null}
      {situacaoWarning ? <p className="text-sm text-amber-700">{situacaoWarning}</p> : null}
      {lastOk ? <p className="text-sm text-success">{lastOk}</p> : null}
    </FormField>
  );
}
