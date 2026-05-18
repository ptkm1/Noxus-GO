import type { CnpjCompanyData } from "@pedidos/shared";
import {
  cnpjDigitsOnly,
  formatCnpjMask,
  isCnpjComplete,
  suggestedTradeName,
} from "@pedidos/shared";
import { useCallback, useState } from "react";
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

  const lookup = useCallback(async () => {
    const d = cnpjDigitsOnly(digits);
    setHint(null);
    setLastOk(null);
    if (d.length !== 14) {
      setHint("Informe os 14 dígitos do CNPJ.");
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
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setLoading(false);
    }
  }, [digits, onApply]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">CNPJ (opcional)</label>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0001-00"
          disabled={disabled || loading}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100"
          value={formatCnpjMask(digits)}
          onChange={(e) => setDigits(cnpjDigitsOnly(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void lookup();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || loading || !isCnpjComplete(digits)}
          onClick={() => void lookup()}
          className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100 disabled:opacity-50"
        >
          {loading ? "A consultar…" : buttonLabel}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Consulta pública via{" "}
        <a
          href="https://brasilapi.com.br/"
          target="_blank"
          rel="noreferrer"
          className="text-brand-600 underline"
        >
          BrasilAPI
        </a>
        . Os dados podem estar desatualizados — confira sempre na Receita Federal.
      </p>
      {hint ? <p className="text-sm text-red-600">{hint}</p> : null}
      {lastOk ? <p className="text-sm text-emerald-700">{lastOk}</p> : null}
    </div>
  );
}
