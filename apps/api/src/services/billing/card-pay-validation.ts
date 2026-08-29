import {
    isValidCardExpiry,
    isValidCvv,
    isValidLuhn,
    normalizeCardNumber,
    parseCardExpiry,
} from "@pedidos/shared";
import { z } from "zod";
import { isValidCpfOrCnpj, normalizeDocument } from "./document.js";

const holderSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(200),
  cpfCnpj: z
    .string()
    .trim()
    .min(11)
    .max(18)
    .transform((v) => normalizeDocument(v))
    .refine(isValidCpfOrCnpj, "CPF ou CNPJ inválido"),
  postalCode: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, "CEP inválido"),
  addressNumber: z.string().trim().min(1).max(20),
  addressComplement: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  mobilePhone: z.string().trim().min(10).max(20),
});

export const subscriptionCardPayBodySchema = z
  .object({
    creditCard: z.object({
      holderName: z.string().trim().min(3).max(120),
      number: z
        .string()
        .trim()
        .min(13)
        .max(24)
        .transform(normalizeCardNumber)
        .refine(isValidLuhn, "Número do cartão inválido"),
      expiry: z.string().trim().min(4).max(7),
      ccv: z
        .string()
        .trim()
        .min(3)
        .max(4)
        .refine(isValidCvv, "CVV inválido"),
    }),
    creditCardHolderInfo: holderSchema,
  })
  .superRefine((data, ctx) => {
    const parsed = parseCardExpiry(data.creditCard.expiry);
    if (!parsed) {
      ctx.addIssue({
        code: "custom",
        message: "Validade do cartão inválida",
        path: ["creditCard", "expiry"],
      });
      return;
    }
    if (!isValidCardExpiry(parsed.month, parsed.year)) {
      ctx.addIssue({
        code: "custom",
        message: "Cartão expirado",
        path: ["creditCard", "expiry"],
      });
    }
  });

export type SubscriptionCardPayBody = z.infer<
  typeof subscriptionCardPayBodySchema
>;

export const subscriptionPayBodySchema = z.union([
  z.object({ method: z.literal("PIX") }),
  z.object({ method: z.literal("BOLETO") }),
  subscriptionCardPayBodySchema.and(
    z.object({ method: z.literal("CREDIT_CARD").optional() }),
  ),
]);

export type SubscriptionPayBody = z.infer<typeof subscriptionPayBodySchema>;

export function isCardPayBody(
  body: SubscriptionPayBody,
): body is SubscriptionCardPayBody {
  return "creditCard" in body;
}

export function toGatewayCardPayload(body: SubscriptionCardPayBody) {
  const expiry = parseCardExpiry(body.creditCard.expiry)!;
  return {
    creditCard: {
      holderName: body.creditCard.holderName,
      number: body.creditCard.number,
      expiryMonth: expiry.month,
      expiryYear: expiry.year,
      ccv: body.creditCard.ccv.replace(/\D/g, ""),
    },
    creditCardHolderInfo: {
      name: body.creditCardHolderInfo.name,
      email: body.creditCardHolderInfo.email.trim().toLowerCase(),
      cpfCnpj: body.creditCardHolderInfo.cpfCnpj,
      postalCode: body.creditCardHolderInfo.postalCode,
      addressNumber: body.creditCardHolderInfo.addressNumber,
      addressComplement: body.creditCardHolderInfo.addressComplement ?? null,
      phone: body.creditCardHolderInfo.phone?.replace(/\D/g, "") || null,
      mobilePhone: body.creditCardHolderInfo.mobilePhone.replace(/\D/g, ""),
    },
  };
}

/** Remove possíveis dados sensíveis de mensagens de erro do gateway. */
export function sanitizePaymentErrorMessage(message: string): string {
  return message
    .replace(/\d{13,19}/g, "****")
    .replace(/\b\d{3,4}\b/g, "***")
    .slice(0, 280);
}
