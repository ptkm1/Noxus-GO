/** BrasilAPI bloqueia o User-Agent padrão do undici/Node (responde 403). */
export const BRASIL_API_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Pedidos/1.0 (+cnpj-cep-ibge; server-side lookup)",
} as const;
