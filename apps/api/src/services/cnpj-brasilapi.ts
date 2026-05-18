import type { CnpjCompanyData } from "@pedidos/shared";

const BRASIL_API_CNPJ = "https://brasilapi.com.br/api/cnpj/v1";

function formatPhoneFromBrasilApi(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const x = raw.replace(/\D/g, "");
  if (x.length === 11) return `(${x.slice(0, 2)}) ${x.slice(2, 7)}-${x.slice(7)}`;
  if (x.length === 10) return `(${x.slice(0, 2)}) ${x.slice(2, 6)}-${x.slice(6)}`;
  return raw.trim();
}

function formatCep(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return raw.trim() || null;
}

export function mapBrasilApiCnpj(json: Record<string, unknown>): CnpjCompanyData {
  const razaoSocial = typeof json.razao_social === "string" ? json.razao_social.trim() : "";
  const nfRaw = typeof json.nome_fantasia === "string" ? json.nome_fantasia.trim() : "";
  const nomeFantasia = nfRaw.length > 0 ? nfRaw : null;

  return {
    cnpj: typeof json.cnpj === "string" ? json.cnpj.replace(/\D/g, "") : "",
    razaoSocial,
    nomeFantasia,
    situacaoCadastral:
      typeof json.descricao_situacao_cadastral === "string"
        ? json.descricao_situacao_cadastral
        : null,
    cep: formatCep(json.cep),
    uf: typeof json.uf === "string" ? json.uf : null,
    municipio: typeof json.municipio === "string" ? json.municipio : null,
    logradouro: typeof json.logradouro === "string" ? json.logradouro.trim() : null,
    numero: typeof json.numero === "string" ? json.numero.trim() : null,
    complemento: typeof json.complemento === "string" ? json.complemento.trim() || null : null,
    bairro: typeof json.bairro === "string" ? json.bairro.trim() : null,
    email: typeof json.email === "string" && json.email.trim() ? json.email.trim().toLowerCase() : null,
    telefone: formatPhoneFromBrasilApi(json.ddd_telefone_1),
    naturezaJuridica:
      typeof json.natureza_juridica === "string" ? json.natureza_juridica.trim() : null,
  };
}

export async function fetchCnpjFromBrasilApi(digits14: string): Promise<CnpjCompanyData> {
  const url = `${BRASIL_API_CNPJ}/${digits14}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 18_000);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok) {
    const msg =
      typeof body?.message === "string"
        ? body.message
        : res.status === 404
          ? "CNPJ não encontrado."
          : `Consulta indisponível (${res.status}).`;
    throw new Error(msg);
  }

  if (!body || typeof body !== "object") {
    throw new Error("Resposta inválida da API de CNPJ.");
  }

  return mapBrasilApiCnpj(body);
}
