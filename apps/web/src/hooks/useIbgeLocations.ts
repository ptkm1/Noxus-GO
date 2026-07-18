import { apiFetch } from "@/lib/api";
import type { IbgeMunicipio, IbgeUf } from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";

export function useIbgeUfs() {
  return useQuery({
    queryKey: ["integrations", "ibge", "ufs", "v2"],
    queryFn: () =>
      apiFetch<IbgeUf[]>("/integrations/ibge/ufs", { skipAuth: true }),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useIbgeMunicipios(uf: string) {
  const sigla = uf.trim().toUpperCase();
  return useQuery({
    queryKey: ["integrations", "ibge", "municipios", sigla, "v2"],
    queryFn: () =>
      apiFetch<IbgeMunicipio[]>(`/integrations/ibge/municipios/${sigla}`, {
        skipAuth: true,
      }),
    enabled: /^[A-Z]{2}$/.test(sigla),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
