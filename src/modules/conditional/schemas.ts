import { z } from "zod";

export const conditionalPolicySchema = z.object({
  enabled: z.coerce.boolean().default(false),
  maxItemsPerOrder: z.coerce.number().int().min(1).max(100),
  maxOrderAmount: z.coerce.number().min(0).max(1_000_000),
  maxOpenConditionalOrders: z.coerce.number().int().min(1).max(100),
  maxCustomerExposure: z.coerce.number().min(0).max(1_000_000),
  decisionDeadlineDays: z.coerce.number().int().min(1).max(90),
  returnShippingPolicy: z.enum(["FREE", "MIN_PURCHASE", "PAID"]).default("FREE"),
  returnShippingMinPurchase: z.coerce.number().min(0).optional().nullable(),
  returnShippingAmount: z.coerce.number().min(0).optional().nullable(),
});

export const conditionalOverrideSchema = z.object({
  enabled: z.coerce.boolean().optional().nullable(),
  maxItemsPerOrder: z.coerce.number().int().min(1).max(100).optional().nullable(),
  maxOrderAmount: z.coerce.number().min(0).optional().nullable(),
  maxOpenConditionalOrders: z.coerce.number().int().min(1).max(100).optional().nullable(),
  maxCustomerExposure: z.coerce.number().min(0).optional().nullable(),
});

export const conditionalTermSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(20_000),
});

export const conditionalDecisionSchema = z.object({
  orderId: z.string().min(1),
  decisions: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        decision: z.enum(["KEEP", "RETURN"]),
      }),
    )
    .min(1),
});

export type ConditionalPolicyInput = z.infer<typeof conditionalPolicySchema>;
export type ConditionalOverrideInput = z.infer<typeof conditionalOverrideSchema>;
export type ConditionalTermInput = z.infer<typeof conditionalTermSchema>;
export type ConditionalDecisionInput = z.infer<typeof conditionalDecisionSchema>;
