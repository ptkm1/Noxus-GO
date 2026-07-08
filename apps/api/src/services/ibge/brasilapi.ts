import type { IbgeMunicipio, IbgeUf } from "@pedidos/shared";

type BrasilApiUf = { id?: number; sigla?: string; nome?: string };
type BrasilApiMunicipio = {
  id?: number;
  nome?: string;
  codigo_ibge?: string;
};

export async function fetchIbgeUfs(): Promise<IbgeUf[]> {
  const res = await fetch("https://brasilapi.com.br/api/ibge/uf/v1", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Falha ao listar UFs.");
  const json = (await res.json()) as BrasilApiUf[];
  return json
    .filter((u) => typeof u.sigla === "string" && typeof u.nome === "string")
    .map((u) => ({
      id: Number(u.id ?? 0),
      sigla: u.sigla!.toUpperCase(),
      nome: u.nome!,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

export async function fetchIbgeMunicipios(
  uf: string,
): Promise<IbgeMunicipio[]> {
  const sigla = uf.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(sigla)) {
    throw new Error("UF inválida.");
  }
  const res = await fetch(
    `https://brasilapi.com.br/api/ibge/municipios/v1/${sigla}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error("Falha ao listar municípios.");
  const json = (await res.json()) as BrasilApiMunicipio[];
  return json
    .filter((m) => typeof m.nome === "string")
    .map((m) => {
      const rawId = m.id ?? m.codigo_ibge;
      const id =
        typeof rawId === "number"
          ? rawId
          : typeof rawId === "string"
            ? Number(rawId)
            : NaN;
      return { id, nome: m.nome! };
    })
    .filter((m) => Number.isFinite(m.id) && m.id > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}
