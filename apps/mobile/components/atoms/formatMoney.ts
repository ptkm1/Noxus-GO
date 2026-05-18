/** Formata valor monetário para exibição em pt-BR (duas casas, vírgula decimal). */
export function fmtMoney(n: number): string {
  return n.toFixed(2).replace(".", ",");
}
