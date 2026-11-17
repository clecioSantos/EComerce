import "server-only";

import type { ConditionalPurchaseStatus } from "@/generated/prisma/enums";
import { roundMoney } from "@/modules/pricing/engine";

import { prisma, type ConditionalDb } from "./db";

/**
 * Estados em que a mercadoria ainda gera exposição financeira (sob
 * responsabilidade do cliente ou em retorno). Saem da exposição apenas quando
 * encerrados, cancelados ou expirados.
 */
export const EXPOSURE_ACTIVE_STATUSES: ConditionalPurchaseStatus[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "DECISION_PENDING",
  "PROCESSING_DECISION",
  "RETURNING",
  "INSPECTING",
  "ISSUE_FOUND",
];

/** Exposição financeira condicional atual do cliente. */
export async function getCustomerExposure(
  userId: string,
  db: ConditionalDb = prisma,
): Promise<number> {
  const result = await db.conditionalPurchase.aggregate({
    where: { order: { userId }, status: { in: EXPOSURE_ACTIVE_STATUSES } },
    _sum: { exposureAmount: true },
  });
  return roundMoney(Number(result._sum.exposureAmount ?? 0));
}

/** Quantidade de pedidos condicionais abertos do cliente. */
export async function getOpenConditionalOrders(
  userId: string,
  db: ConditionalDb = prisma,
): Promise<number> {
  return db.conditionalPurchase.count({
    where: { order: { userId }, status: { in: EXPOSURE_ACTIVE_STATUSES } },
  });
}
