import { z } from "zod";

export const registerCustomerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(72),
  phone: z.string().max(30).optional().nullable(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional().nullable(),
});

export const addressSchema = z.object({
  label: z.string().max(60).optional().nullable(),
  recipient: z.string().min(2).max(120),
  line1: z.string().min(3).max(160),
  line2: z.string().max(160).optional().nullable(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  postalCode: z.string().min(4).max(12),
  country: z.string().min(2).max(3).default("BR"),
  phone: z.string().max(30).optional().nullable(),
  isDefault: z.coerce.boolean().default(false),
});

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
