import type { CnpjCompanyData } from "@pedidos/shared";
import { cnpjCityIbgeCode } from "./fiscal-emitente.js";

const SERPRO_TOKEN_URL = "https://gateway.apiserpro.serpro.gov.br/token";
const SERPRO_CNPJ_BASE = "https://gateway.apiserpro.serpro.gov.br/consulta-cnpj-df/v2";

type SerproCredentials = {
  consumerKey: string;
  consumerSecret: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function readSerproCredentials(): SerproCredentials | null {
  const consumerKey = process.env.SERPRO_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.SERPRO_CONSUMER_SECRET?.trim();
  if (!consumerKey || !consumerSecret) return null;
  return { consumerKey, consumerSecret };
}

export function isSerproConfigured(): boolean {
  return readSerproCredentials() !== null;
}

async function fetchSerproAccessToken(creds: SerproCredentials): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");
  const res = await fetch(SERPRO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || typeof body?.access_token !== "string") {
    throw new Error("Falha ao autenticar na API Serpro (Consulta CNPJ).");
  }

  const expiresIn =
    typeof body.expires_in === "number" && Number.isFinite(body.expires_in) ? body.expires_in : 3600;
  cachedToken = {
    value: body.access_token,
    expiresAt: now + expiresIn * 1000,
  };
  return body.access_token;
}

function formatPhoneFromSerpro(raw: unknown): string | null {
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

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function mapSerproCnpj(json: Record<string, unknown>): CnpjCompanyData {
  const endereco =
    json.endereco && typeof json.endereco === "object"
      ? (json.endereco as Record<string, unknown>)
      : null;

  const razaoSocial = pickString(json, "nomeEmpresarial", "razao_social") ?? "";
  const nomeFantasia = pickString(json, "nomeFantasia", "nome_fantasia");

  return {
    cnpj:
      typeof json.ni === "string"
        ? json.ni.replace(/\D/g, "")
        : typeof json.cnpj === "string"
          ? json.cnpj.replace(/\D/g, "")
          : "",
    razaoSocial,
    nomeFantasia,
    situacaoCadastral:
      pickString(json, "situacaoCadastral", "descricao_situacao_cadastral") ??
      (typeof json.situacaoCadastral === "object" &&
      json.situacaoCadastral &&
      typeof (json.situacaoCadastral as Record<string, unknown>).codigo === "string"
        ? String((json.situacaoCadastral as Record<string, unknown>).codigo)
        : null),
    cep: formatCep(endereco?.cep ?? json.cep),
    uf: pickString(endereco ?? json, "uf"),
    municipio: pickString(endereco ?? json, "municipio", "descricaoMunicipio"),
    cityIbgeCode: cnpjCityIbgeCode(endereco ?? json),
    logradouro: pickString(endereco ?? json, "logradouro", "tipoLogradouro"),
    numero: pickString(endereco ?? json, "numero"),
    complemento: pickString(endereco ?? json, "complemento"),
    bairro: pickString(endereco ?? json, "bairro"),
    email: pickString(json, "correioEletronico", "email")?.toLowerCase() ?? null,
    telefone: formatPhoneFromSerpro(json.telefone ?? endereco?.telefone),
    naturezaJuridica: pickString(json, "naturezaJuridica", "natureza_juridica"),
  };
}

export async function fetchCnpjFromSerpro(digits14: string): Promise<CnpjCompanyData> {
  const creds = readSerproCredentials();
  if (!creds) {
    throw new Error(
      "Provedor Serpro selecionado, mas SERPRO_CONSUMER_KEY/SERPRO_CONSUMER_SECRET não estão configurados.",
    );
  }

  const token = await fetchSerproAccessToken(creds);
  const url = `${SERPRO_CNPJ_BASE}/basica/${digits14}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 18_000);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (res.status === 401) {
    cachedToken = null;
    throw new Error("Token Serpro expirado ou inválido.");
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok) {
    const msg =
      typeof body?.message === "string"
        ? body.message
        : res.status === 404
          ? "CNPJ não encontrado."
          : `Consulta Serpro indisponível (${res.status}).`;
    throw new Error(msg);
  }

  if (!body || typeof body !== "object") {
    throw new Error("Resposta inválida da API Serpro (Consulta CNPJ).");
  }

  return mapSerproCnpj(body);
}
