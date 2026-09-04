/** Formata valor monetário para exibição em pt-BR (duas casas, vírgula decimal). */
export function fmtMoney(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/** Placeholder estável para não quebrar layout ao ocultar valores. */
export const MASKED_MONEY = "R$ ••••";

/** Exibe valor formatado ou máscara quando a preferência de privacidade está ativa. */
export function displayMoney(hidden: boolean, amount: number): string {
  return hidden ? MASKED_MONEY : `R$ ${fmtMoney(amount)}`;
}
