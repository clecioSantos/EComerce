import "server-only";

import { z } from "zod";

import { cepSchema } from "@/modules/shipping/schemas";

export const shippingAddressSchema = z.object({
  recipient: z.string().min(2).max(120),
  line1: z.string().min(3).max(160),
  line2: z.string().max(160).optional().nullable(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  postalCode: cepSchema,
  country: z.string().min(2).max(3).default("BR"),
  phone: z.string().max(30).optional().nullable(),
});

export const checkoutOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(2).max(120),
    email: z.email(),
    phone: z.string().max(30).optional().nullable(),
  }),
  shippingAddress: shippingAddressSchema,
  billingAddress: shippingAddressSchema.optional().nullable(),
  shippingOptionId: z.string().min(1),
  paymentMethod: z
    .enum(["CREDIT_CARD", "DEBIT_CARD", "PIX", "BOLETO", "WALLET", "OTHER"])
    .default("PIX"),
  couponCode: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(8).max(120).optional().nullable(),
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
export type ShippingAddressSnapshot = z.infer<typeof shippingAddressSchema>;

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum([
    "PENDING",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELED",
    "REFUNDED",
    "EXPIRED",
  ]),
});
