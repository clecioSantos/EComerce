import { z } from "zod";

/** Remove máscara e mantém apenas dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** CEP brasileiro: 8 dígitos, com ou sem máscara (ex.: "01018-020"). */
export const cepSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((value) => value.length === 8, {
    message: "CEP inválido. Informe 8 dígitos (ex.: 01018-020).",
  });

export function isValidCep(value: string): boolean {
  return /^\d{8}$/.test(onlyDigits(value));
}

/** Dimensão/peso positivo (cm ou kg). Zero/negativo são rejeitados. */
export const positiveMeasureSchema = z.coerce
  .number()
  .positive("Deve ser maior que zero")
  .finite();

export const optionalMeasureSchema = positiveMeasureSchema.optional().nullable();

export const shippingQuoteRequestSchema = z.object({
  postalCode: cepSchema,
});

export type ShippingQuoteRequest = z.infer<typeof shippingQuoteRequestSchema>;

export const storeSettingsSchema = z.object({
  postalCode: cepSchema,
  street: z.string().trim().min(3).max(160),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).optional().nullable(),
  district: z.string().trim().min(1).max(80),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(40),
  shippingServiceIds: z.array(z.string().trim().min(1).max(20)).default([]),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
