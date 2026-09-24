import "server-only";

import type { Coupon, Promotion, Prisma } from "@/generated/prisma/client";
import type { CouponRule, PromotionRule } from "@/modules/pricing/engine";
import { prisma } from "@/lib/db/prisma";

import {
  isPromotionActive,
  validateCouponEligibility,
  type CouponValidationResult,
  type CreateCouponInput,
  type CreatePromotionInput,
} from "./schemas";

export function toPromotionRule(promotion: Promotion): PromotionRule {
  return {
    id: promotion.id,
    name: promotion.name,
    type: promotion.type,
    scope: promotion.scope,
    value: Number(promotion.value),
    categoryId: promotion.categoryId,
    productId: promotion.productId,
    minSubtotal:
      promotion.minSubtotal == null ? null : Number(promotion.minSubtotal),
    minQuantity: promotion.minQuantity,
    stackable: promotion.stackable,
    priority: promotion.priority,
  };
}

export function toCouponRule(coupon: Coupon): CouponRule {
  return {
    code: coupon.code,
    type: coupon.type,
    value: Number(coupon.value),
    minSubtotal: coupon.minSubtotal == null ? null : Number(coupon.minSubtotal),
  };
}

export async function listPromotions() {
  return prisma.promotion.findMany({ orderBy: { priority: "desc" } });
}

export async function getActivePromotionRules(
  now: Date = new Date(),
): Promise<PromotionRule[]> {
  const promotions = await prisma.promotion.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });
  return promotions
    .filter((promotion) => isPromotionActive(promotion, now))
    .map(toPromotionRule);
}

export async function createPromotion(input: CreatePromotionInput) {
  return prisma.promotion.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      value: input.value,
      scope: input.scope,
      categoryId: input.categoryId ?? null,
      productId: input.productId ?? null,
      minSubtotal: input.minSubtotal ?? null,
      minQuantity: input.minQuantity ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive,
      stackable: input.stackable,
      priority: input.priority,
    },
  });
}

export async function updatePromotion(
  id: string,
  input: Partial<CreatePromotionInput>,
) {
  return prisma.promotion.update({ where: { id }, data: input });
}

export async function deletePromotion(id: string) {
  return prisma.promotion.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Cupons
// ---------------------------------------------------------------------------

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createCoupon(input: CreateCouponInput) {
  return prisma.coupon.create({
    data: {
      code: input.code,
      description: input.description ?? null,
      type: input.type,
      value: input.value,
      minSubtotal: input.minSubtotal ?? null,
      maxUses: input.maxUses ?? null,
      maxUsesPerUser: input.maxUsesPerUser ?? null,
      isActive: input.isActive,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    },
  });
}

export async function getCouponByCode(code: string) {
  return prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
}

export interface CouponCheck extends CouponValidationResult {
  coupon: Coupon | null;
}

export async function validateCouponForCart(
  code: string,
  subtotal: number,
  userId?: string | null,
): Promise<CouponCheck> {
  const coupon = await getCouponByCode(code);

  let userUsageCount = 0;
  if (coupon && userId) {
    userUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });
  }

  const result = validateCouponEligibility({
    coupon,
    subtotal,
    userUsageCount,
  });

  return { ...result, coupon: result.valid ? coupon : null };
}

export async function recordCouponUsage(params: {
  couponId: string;
  orderId: string;
  userId?: string | null;
}) {
  const { couponId, orderId, userId } = params;
  return prisma.$transaction((tx) =>
    consumeCoupon(tx, { couponId, orderId, userId }),
  );
}

/**
 * Consome o cupom de forma ATÔMICA, dentro da transação do checkout.
 *
 * - `maxUses`: UPDATE condicional (`usedCount < maxUses`) que bloqueia a linha
 *   do cupom até o commit, serializando checkouts concorrentes para o mesmo
 *   cupom.
 * - `maxUsesPerUser`: contagem feita DEPOIS de adquirir o lock do cupom, então
 *   também é serializada por cupom.
 *
 * Qualquer falha lança erro e faz rollback de todo o checkout.
 */
export async function consumeCoupon(
  db: Prisma.TransactionClient,
  params: { couponId: string; orderId: string; userId?: string | null },
): Promise<void> {
  const affected = await db.$executeRaw`
    UPDATE "coupons"
    SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${params.couponId}
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;

  if (affected === 0) {
    const exists = await db.coupon.findUnique({
      where: { id: params.couponId },
      select: { id: true },
    });
    if (!exists) throw new Error("Cupom não encontrado.");
    throw new Error("Cupom esgotado.");
  }

  const coupon = await db.coupon.findUnique({
    where: { id: params.couponId },
    select: { isActive: true, maxUsesPerUser: true },
  });
  if (!coupon) throw new Error("Cupom não encontrado.");
  if (!coupon.isActive) throw new Error("Cupom inativo.");

  if (coupon.maxUsesPerUser != null && params.userId) {
    const used = await db.couponUsage.count({
      where: { couponId: params.couponId, userId: params.userId },
    });
    if (used >= coupon.maxUsesPerUser) {
      throw new Error(
        "Você já utilizou este cupom o número máximo de vezes.",
      );
    }
  }

  await db.couponUsage.create({
    data: {
      couponId: params.couponId,
      orderId: params.orderId,
      userId: params.userId ?? null,
    },
  });
}
