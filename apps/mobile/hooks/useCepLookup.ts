import { apiFetch } from "@/lib/api";
import type { CepAddressData } from "@pedidos/shared";
import { cepDigitsOnly, isCepComplete } from "@pedidos/shared";
import { useCallback, useState } from "react";

export function useCepLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (rawCep: string): Promise<CepAddressData | null> => {
      const digits = cepDigitsOnly(rawCep);
      setError(null);
      if (!isCepComplete(digits)) {
        setError("Informe os 8 dígitos do CEP.");
        return null;
      }
      setLoading(true);
      try {
        return await apiFetch<CepAddressData>(`/integrations/cep/${digits}`, {
          skipAuth: true,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao consultar CEP.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { lookup, loading, error, clearError: () => setError(null) };
}
