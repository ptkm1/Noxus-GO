/** Erros tipicamente de rede / API inacessível (não 401 de auth). */
export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /Sem ligação|Refresh falhou|Network request failed|Failed to fetch|API está acessível|Pedido falhou|timed out|ECONNREFUSED|ENOTFOUND|Network Error/i.test(
    msg,
  );
}
