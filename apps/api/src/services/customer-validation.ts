import {
  cnpjDigitsOnly,
  cpfDigitsOnly,
  isValidCnpj,
  isValidCpf,
} from "@pedidos/shared";
import type { CustomerDocumentType } from "@prisma/client";
import { z } from "zod";
import { buildCustomerAddressNote } from "./customer-address.js";

const optionalStr = z.string().trim().optional().nullable();

const customerFieldsSchema = z.object({
  name: z.string().trim().min(1),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  phone: optionalStr,
  sellerId: z.string().optional().nullable(),
  regionId: z.string().optional().nullable(),
  latitude: z.number().gte(-90).lte(90).nullable().optional(),
  longitude: z.number().gte(-180).lte(180).nullable().optional(),
  addressNote: z.string().max(500).nullable().optional(),
  documentType: z.enum(["CNPJ", "CPF"]).optional().nullable(),
  cnpj: optionalStr,
  cpf: optionalStr,
  legalName: optionalStr,
  tradeName: optionalStr,
  cep: optionalStr,
  street: optionalStr,
  number: optionalStr,
  neighborhood: optionalStr,
  state: z.union([z.string().length(2), z.literal(""), z.null()]).optional(),
  city: optionalStr,
  cityIbgeCode: optionalStr,
  stateRegistration: optionalStr,
  buyerName: optionalStr,
  notes: z.string().max(2000).optional().nullable(),
  creditLimit: z.number().positive().nullable().optional(),
  creditBlocked: z.boolean().optional(),
});

type CustomerFields = z.infer<typeof customerFieldsSchema>;

function refineCustomerDocument(
  data: Partial<CustomerFields>,
  ctx: z.RefinementCtx,
  opts?: { partial?: boolean },
) {
  const partial = opts?.partial ?? false;

  const validateCnpj =
    data.documentType === "CNPJ" || (partial && data.cnpj !== undefined);
  if (validateCnpj) {
    const d = cnpjDigitsOnly(data.cnpj ?? "");
    if (!d) {
      ctx.addIssue({
        code: "custom",
        message: "CNPJ obrigatório.",
        path: ["cnpj"],
      });
    } else if (!isValidCnpj(d)) {
      ctx.addIssue({
        code: "custom",
        message: "CNPJ inválido.",
        path: ["cnpj"],
      });
    }
  }

  const validateCpf =
    data.documentType === "CPF" || (partial && data.cpf !== undefined);
  if (validateCpf) {
    const d = cpfDigitsOnly(data.cpf ?? "");
    if (!d) {
      ctx.addIssue({
        code: "custom",
        message: "CPF obrigatório.",
        path: ["cpf"],
      });
    } else if (!isValidCpf(d)) {
      ctx.addIssue({
        code: "custom",
        message: "CPF inválido.",
        path: ["cpf"],
      });
    }
  }

  if (data.state && data.state !== "" && !/^[A-Z]{2}$/.test(data.state)) {
    ctx.addIssue({
      code: "custom",
      message: "UF inválida.",
      path: ["state"],
    });
  }

  if (!partial) {
    const ie = (data.stateRegistration ?? "").trim();
    if (!ie) {
      ctx.addIssue({
        code: "custom",
        message: "Inscrição estadual obrigatória.",
        path: ["stateRegistration"],
      });
    }
  }
}

export const customerBodySchema = customerFieldsSchema.superRefine(
  (data, ctx) => refineCustomerDocument(data, ctx),
);

export type CustomerBodyInput = z.infer<typeof customerBodySchema>;

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function normalizeEmail(v: string | null | undefined): string | null {
  return emptyToNull(v ?? null);
}

export function resolveCustomerName(data: CustomerBodyInput): string {
  if (data.documentType === "CNPJ") {
    const trade = emptyToNull(data.tradeName ?? null);
    const legal = emptyToNull(data.legalName ?? null);
    return trade ?? legal ?? data.name.trim();
  }
  return data.name.trim();
}

export function toCustomerPrismaData(
  data: CustomerBodyInput,
  opts?: { includeCredit?: boolean },
): Record<string, unknown> {
  const documentType = data.documentType as
    | CustomerDocumentType
    | null
    | undefined;
  const isCnpj = documentType === "CNPJ";
  const isCpf = documentType === "CPF";

  const street = emptyToNull(data.street ?? null);
  const number = emptyToNull(data.number ?? null);
  const neighborhood = emptyToNull(data.neighborhood ?? null);
  const city = emptyToNull(data.city ?? null);
  const state = emptyToNull(data.state ?? null)?.toUpperCase() ?? null;
  const cep = emptyToNull(data.cep ?? null);

  const addressNote =
    data.addressNote !== undefined
      ? data.addressNote === null
        ? null
        : data.addressNote.trim() || null
      : buildCustomerAddressNote({
          street,
          number,
          neighborhood,
          city,
          state,
          cep,
        });

  const out: Record<string, unknown> = {
    name: resolveCustomerName(data),
    email: normalizeEmail(data.email ?? null),
    phone: emptyToNull(data.phone ?? null),
    addressNote,
    documentType: documentType ?? null,
    cnpj: isCnpj ? cnpjDigitsOnly(data.cnpj ?? "") : null,
    cpf: isCpf ? cpfDigitsOnly(data.cpf ?? "") : null,
    legalName: isCnpj ? emptyToNull(data.legalName ?? null) : null,
    tradeName: isCnpj ? emptyToNull(data.tradeName ?? null) : null,
    cep,
    street,
    number,
    neighborhood,
    state,
    city,
    cityIbgeCode: emptyToNull(data.cityIbgeCode ?? null),
    stateRegistration: emptyToNull(data.stateRegistration ?? null),
    buyerName: emptyToNull(data.buyerName ?? null),
    notes: emptyToNull(data.notes ?? null),
  };

  if (data.sellerId !== undefined) out.sellerId = data.sellerId;
  if (data.regionId !== undefined) out.regionId = data.regionId;
  if (data.latitude !== undefined) out.latitude = data.latitude;
  if (data.longitude !== undefined) out.longitude = data.longitude;

  if (opts?.includeCredit) {
    if (data.creditLimit !== undefined) out.creditLimit = data.creditLimit;
    if (data.creditBlocked !== undefined)
      out.creditBlocked = data.creditBlocked;
  }

  return out;
}

export const customerPatchSchema = customerFieldsSchema
  .partial()
  .extend({ name: z.string().trim().min(1).optional() })
  .superRefine((data, ctx) =>
    refineCustomerDocument(data, ctx, { partial: true }),
  );
