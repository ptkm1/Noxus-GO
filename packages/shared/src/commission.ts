export type SellerCommissionType =
  | "FIXED"
  | "BY_PRODUCT"
  | "BY_CATEGORY"
  | "BY_SUPPLIER";

export const SELLER_COMMISSION_TYPES: ReadonlyArray<{
  value: SellerCommissionType;
  label: string;
  description: string;
  /** Opção reservada para feature futura (fornecedor). */
  comingSoon?: boolean;
}> = [
  {
    value: "FIXED",
    label: "Comissão fixa",
    description: "Mesmo percentual em todas as vendas do vendedor.",
  },
  {
    value: "BY_PRODUCT",
    label: "Por produto",
    description: "Percentual definido no cadastro de cada produto.",
  },
  {
    value: "BY_CATEGORY",
    label: "Por grupo de produtos",
    description: "Percentual definido na categoria (grupo) do produto.",
  },
  {
    value: "BY_SUPPLIER",
    label: "Por fornecedor",
    description: "Comissão por fornecedor — disponível em breve.",
    comingSoon: true,
  },
];

export function sellerCommissionTypeLabel(type: SellerCommissionType): string {
  return SELLER_COMMISSION_TYPES.find((t) => t.value === type)?.label ?? type;
}
