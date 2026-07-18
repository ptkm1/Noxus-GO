import { formatStructuredAddress } from "@pedidos/shared";

export type CustomerAddressInput = {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
};

export function buildCustomerAddressNote(
  fields: CustomerAddressInput,
): string | null {
  return formatStructuredAddress(fields);
}
