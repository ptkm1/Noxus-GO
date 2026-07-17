import { cnpjDigitsOnly, isValidCnpj } from "./cnpj.js";
import { cpfDigitsOnly, isValidCpf } from "./cpf.js";

export type CustomerDocumentType = "CNPJ" | "CPF";

export type CustomerFormValues = {
  documentType: CustomerDocumentType;
  cnpj: string;
  cpf: string;
  name: string;
  legalName: string;
  tradeName: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  addressNote: string;
  state: string;
  city: string;
  cityIbgeCode: string;
  stateRegistration: string;
  phone: string;
  email: string;
  buyerName: string;
  notes: string;
};

export type CustomerRecord = CustomerFormValues & {
  id: string;
  sellerId?: string | null;
  creditLimit?: unknown;
  creditBlocked?: boolean;
  latitude?: unknown;
  longitude?: unknown;
};

export function emptyCustomerForm(
  documentType: CustomerDocumentType = "CNPJ",
): CustomerFormValues {
  return {
    documentType,
    cnpj: "",
    cpf: "",
    name: "",
    legalName: "",
    tradeName: "",
    cep: "",
    street: "",
    number: "",
    neighborhood: "",
    addressNote: "",
    state: "",
    city: "",
    cityIbgeCode: "",
    stateRegistration: "",
    phone: "",
    email: "",
    buyerName: "",
    notes: "",
  };
}

export function customerToForm(
  c: Partial<CustomerRecord> & { name: string },
): CustomerFormValues {
  return {
    documentType: (c.documentType as CustomerDocumentType) ?? "CNPJ",
    cnpj: c.cnpj ?? "",
    cpf: c.cpf ?? "",
    name: c.name ?? "",
    legalName: c.legalName ?? "",
    tradeName: c.tradeName ?? "",
    cep: c.cep ?? "",
    street: c.street ?? "",
    number: c.number ?? "",
    neighborhood: c.neighborhood ?? "",
    addressNote: c.addressNote ?? "",
    state: c.state ?? "",
    city: c.city ?? "",
    cityIbgeCode: c.cityIbgeCode ?? "",
    stateRegistration: c.stateRegistration ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    buyerName: c.buyerName ?? "",
    notes: c.notes ?? "",
  };
}

export function formToCustomerPayload(
  values: CustomerFormValues,
  extras?: {
    sellerId?: string | null;
    creditLimit?: number | null;
    creditBlocked?: boolean;
    latitude?: number | null;
    longitude?: number | null;
  },
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    documentType: values.documentType,
    name:
      values.documentType === "CPF"
        ? values.name.trim()
        : values.tradeName.trim() ||
          values.legalName.trim() ||
          values.name.trim(),
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    cnpj: values.documentType === "CNPJ" ? values.cnpj : null,
    cpf: values.documentType === "CPF" ? values.cpf : null,
    legalName:
      values.documentType === "CNPJ" ? values.legalName.trim() || null : null,
    tradeName:
      values.documentType === "CNPJ" ? values.tradeName.trim() || null : null,
    cep: values.cep.trim() || null,
    street: values.street.trim() || null,
    number: values.number.trim() || null,
    neighborhood: values.neighborhood.trim() || null,
    addressNote: values.addressNote.trim() || null,
    state: values.state.trim().toUpperCase() || null,
    city: values.city.trim() || null,
    cityIbgeCode: values.cityIbgeCode.trim() || null,
    stateRegistration: values.stateRegistration.trim() || null,
    buyerName: values.buyerName.trim() || null,
    notes: values.notes.trim() || null,
  };
  if (extras?.sellerId !== undefined) base.sellerId = extras.sellerId;
  if (extras?.creditLimit !== undefined) base.creditLimit = extras.creditLimit;
  if (extras?.creditBlocked !== undefined)
    base.creditBlocked = extras.creditBlocked;
  if (extras?.latitude !== undefined) base.latitude = extras.latitude;
  if (extras?.longitude !== undefined) base.longitude = extras.longitude;
  return base;
}

export type CustomerFormErrors = Partial<
  Record<keyof CustomerFormValues, string>
>;

/** Valor gravado quando o utilizador marca que não sabe a IE. */
export const STATE_REGISTRATION_UNAVAILABLE = "indisponível";

export function isStateRegistrationUnavailable(value: string): boolean {
  return value.trim().toLowerCase() === STATE_REGISTRATION_UNAVAILABLE;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateDocument(values: CustomerFormValues): CustomerFormErrors {
  const errors: CustomerFormErrors = {};

  if (values.documentType === "CNPJ") {
    const cnpj = cnpjDigitsOnly(values.cnpj);
    if (!cnpj) errors.cnpj = "CNPJ é obrigatório.";
    else if (cnpj.length !== 14) errors.cnpj = "CNPJ deve ter 14 dígitos.";
    else if (!isValidCnpj(cnpj))
      errors.cnpj = "CNPJ inválido (verifique os dígitos).";

    if (!values.legalName.trim() && !values.tradeName.trim()) {
      errors.legalName = "Informe a razão social ou o nome fantasia.";
    }
  } else {
    const cpf = cpfDigitsOnly(values.cpf);
    if (!cpf) errors.cpf = "CPF é obrigatório.";
    else if (cpf.length !== 11) errors.cpf = "CPF deve ter 11 dígitos.";
    else if (!isValidCpf(cpf))
      errors.cpf = "CPF inválido (verifique os dígitos).";

    if (!values.name.trim()) errors.name = "Nome completo é obrigatório.";
  }

  return errors;
}

/** Validação client-side alinhada às regras do cadastro. */
export function validateCustomerForm(
  values: CustomerFormValues,
): CustomerFormErrors {
  const errors = validateDocument(values);

  if (!values.stateRegistration.trim()) {
    errors.stateRegistration =
      "Informe a inscrição estadual ou marque que não sabe.";
  }

  const email = values.email.trim();
  if (email && !EMAIL_RE.test(email)) {
    errors.email = "Informe um e-mail válido.";
  }

  return errors;
}

/** Erros relevantes para cada passo do wizard mobile. */
export function validateCustomerFormStep(
  step: number,
  values: CustomerFormValues,
): CustomerFormErrors {
  const all = validateCustomerForm(values);
  const out: CustomerFormErrors = {};

  if (step === 0) {
    if (values.documentType === "CNPJ") {
      for (const key of ["cnpj", "legalName", "tradeName"] as const) {
        if (all[key]) out[key] = all[key];
      }
    } else {
      for (const key of ["cpf", "name"] as const) {
        if (all[key]) out[key] = all[key];
      }
    }
    return out;
  }

  if (step === 1 && all.stateRegistration) {
    out.stateRegistration = all.stateRegistration;
    return out;
  }

  if (step === 2 && all.email) out.email = all.email;
  return out;
}

/** Primeiro passo do wizard que contém erro (para navegação). */
export function customerFormErrorStep(errors: CustomerFormErrors): number {
  const step0Keys = ["cnpj", "cpf", "legalName", "tradeName", "name"] as const;
  if (step0Keys.some((k) => errors[k])) return 0;
  if (errors.stateRegistration) return 1;
  if (errors.email) return 2;
  return 0;
}

export function isCustomerFormValid(values: CustomerFormValues): boolean {
  return Object.keys(validateCustomerForm(values)).length === 0;
}
