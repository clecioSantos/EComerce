import { z } from "zod";

export const discountTypeSchema = z.enum([
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "FREE_SHIPPING",
]);

export const discountScopeSchema = z.enum(["CART", "CATEGORY", "PRODUCT"]);

const optionalDate = z
  .union([z.string().datetime(), z.string().date(), z.null()])
  .optional()
  .transform((value) => (value ? new Date(value) : null));

export const promotionTypeSchema = discountTypeSchema;
export const promotionScopeSchema = discountScopeSchema;

export const createPromotionSchema = z
  .object({
    name: z.string().min(2).max(120),
    description: z.string().max(500).optional().nullable(),
    type: discountTypeSchema,
    value: z.coerce.number().min(0).default(0),
    scope: discountScopeSchema.default("CART"),
    categoryId: z.string().cuid().optional().nullable(),
    productId: z.string().cuid().optional().nullable(),
    minSubtotal: z.coerce.number().min(0).optional().nullable(),
    minQuantity: z.coerce.number().int().min(1).optional().nullable(),
    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.coerce.boolean().default(true),
    stackable: z.coerce.boolean().default(true),
    priority: z.coerce.number().int().default(0),
  })
  .refine(
    (data) => data.type !== "PERCENTAGE" || (data.value > 0 && data.value <= 100),
    { message: "Percentual deve estar entre 0 e 100", path: ["value"] },
  )
  .refine((data) => data.scope !== "CATEGORY" || Boolean(data.categoryId), {
    message: "Promoção por categoria exige categoryId",
    path: ["categoryId"],
  })
  .refine((data) => data.scope !== "PRODUCT" || Boolean(data.productId), {
    message: "Promoção por produto exige productId",
    path: ["productId"],
  })
  .refine(
    (data) =>
      !data.startsAt || !data.endsAt || data.startsAt.getTime() < data.endsAt.getTime(),
    { message: "Data final deve ser posterior à inicial", path: ["endsAt"] },
  );

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(40)
      .transform((value) => value.trim().toUpperCase()),
    description: z.string().max(300).optional().nullable(),
    type: discountTypeSchema,
    value: z.coerce.number().min(0).default(0),
    minSubtotal: z.coerce.number().min(0).optional().nullable(),
    maxUses: z.coerce.number().int().min(1).optional().nullable(),
    maxUsesPerUser: z.coerce.number().int().min(1).optional().nullable(),
    isActive: z.coerce.boolean().default(true),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .refine(
    (data) => data.type !== "PERCENTAGE" || (data.value > 0 && data.value <= 100),
    { message: "Percentual deve estar entre 0 e 100", path: ["value"] },
  );

export const applyCouponSchema = z.object({
  code: z.string().min(3).max(40),
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

// ---------------------------------------------------------------------------
// Regras puras (testáveis sem banco)
// ---------------------------------------------------------------------------

export type NumericLike = number | string | { toString(): string };

export interface PromotionLike {
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  scope: "CART" | "CATEGORY" | "PRODUCT";
  value: NumericLike;
  categoryId?: string | null;
  productId?: string | null;
  minSubtotal?: NumericLike | null;
  minQuantity?: number | null;
  stackable?: boolean;
  priority?: number;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface CouponLike {
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: NumericLike;
  minSubtotal?: NumericLike | null;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  usedCount?: number;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export function isWithinPeriod(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (endsAt && endsAt.getTime() < now.getTime()) return false;
  return true;
}

export function isPromotionActive(
  promotion: PromotionLike,
  now: Date = new Date(),
): boolean {
  if (promotion.isActive === false) return false;
  return isWithinPeriod(promotion.startsAt, promotion.endsAt, now);
}

export function isCouponActive(
  coupon: CouponLike,
  now: Date = new Date(),
): boolean {
  if (coupon.isActive === false) return false;
  return isWithinPeriod(coupon.startsAt, coupon.endsAt, now);
}

export type CouponValidationCode =
  | "OK"
  | "NOT_FOUND"
  | "INACTIVE"
  | "EXPIRED"
  | "MIN_SUBTOTAL"
  | "USAGE_LIMIT"
  | "USER_LIMIT";

export interface CouponValidationResult {
  valid: boolean;
  code: CouponValidationCode;
  message: string;
}

export function validateCouponEligibility(params: {
  coupon: CouponLike | null | undefined;
  subtotal: number;
  userUsageCount?: number;
  now?: Date;
}): CouponValidationResult {
  const { coupon, subtotal, userUsageCount = 0, now = new Date() } = params;

  if (!coupon) {
    return { valid: false, code: "NOT_FOUND", message: "Cupom não encontrado." };
  }
  if (coupon.isActive === false) {
    return { valid: false, code: "INACTIVE", message: "Cupom inativo." };
  }
  if (!isWithinPeriod(coupon.startsAt, coupon.endsAt, now)) {
    return { valid: false, code: "EXPIRED", message: "Cupom expirado ou fora do período." };
  }
  if (coupon.minSubtotal != null && subtotal < Number(coupon.minSubtotal)) {
    return {
      valid: false,
      code: "MIN_SUBTOTAL",
      message: `Valor mínimo para este cupom é ${Number(coupon.minSubtotal).toFixed(2)}.`,
    };
  }
  if (coupon.maxUses != null && (coupon.usedCount ?? 0) >= coupon.maxUses) {
    return { valid: false, code: "USAGE_LIMIT", message: "Cupom esgotado." };
  }
  if (coupon.maxUsesPerUser != null && userUsageCount >= coupon.maxUsesPerUser) {
    return {
      valid: false,
      code: "USER_LIMIT",
      message: "Você já utilizou este cupom o número máximo de vezes.",
    };
  }
  return { valid: true, code: "OK", message: "Cupom aplicado." };
}
