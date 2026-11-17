import "server-only";

import { prisma } from "@/lib/db/prisma";

import { recordAudit } from "./audit.service";
import type { ConditionalOverrideValues } from "./types";

/** Cria o registro do cliente (PENDING) se ainda não existir. */
export async function ensureConditionalCustomer(userId: string) {
  return prisma.conditionalCustomer.upsert({
    where: { userId },
    create: { userId, status: "PENDING" },
    update: {},
  });
}

export async function getConditionalCustomer(userId: string) {
  return prisma.conditionalCustomer.findUnique({ where: { userId } });
}

export async function approveConditionalCustomer(
  userId: string,
  actorUserId: string | null,
) {
  const customer = await ensureConditionalCustomer(userId);
  await prisma.conditionalCustomer.update({
    where: { userId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: actorUserId,
      rejectedAt: null,
      suspendedAt: null,
    },
  });
  await recordAudit({
    event: "CUSTOMER_APPROVED",
    entity: "ConditionalCustomer",
    entityId: customer.id,
    actorUserId,
    metadata: { userId },
  });
}

export async function rejectConditionalCustomer(
  userId: string,
  actorUserId: string | null,
  reason?: string | null,
) {
  const customer = await ensureConditionalCustomer(userId);
  await prisma.conditionalCustomer.update({
    where: { userId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedBy: actorUserId,
      reason: reason ?? null,
    },
  });
  await recordAudit({
    event: "CUSTOMER_REJECTED",
    entity: "ConditionalCustomer",
    entityId: customer.id,
    actorUserId,
    metadata: { userId, reason: reason ?? undefined },
  });
}

export async function suspendConditionalCustomer(
  userId: string,
  actorUserId: string | null,
  reason?: string | null,
) {
  const customer = await ensureConditionalCustomer(userId);
  await prisma.conditionalCustomer.update({
    where: { userId },
    data: {
      status: "SUSPENDED",
      suspendedAt: new Date(),
      suspendedBy: actorUserId,
      reason: reason ?? null,
    },
  });
  await recordAudit({
    event: "CUSTOMER_SUSPENDED",
    entity: "ConditionalCustomer",
    entityId: customer.id,
    actorUserId,
    metadata: { userId, reason: reason ?? undefined },
  });
}

export async function reactivateConditionalCustomer(
  userId: string,
  actorUserId: string | null,
) {
  const customer = await ensureConditionalCustomer(userId);
  await prisma.conditionalCustomer.update({
    where: { userId },
    data: {
      status: "APPROVED",
      suspendedAt: null,
      rejectedAt: null,
      approvedAt: new Date(),
      approvedBy: actorUserId,
    },
  });
  await recordAudit({
    event: "CUSTOMER_REACTIVATED",
    entity: "ConditionalCustomer",
    entityId: customer.id,
    actorUserId,
    metadata: { userId },
  });
}

/** Atualiza o override (campos nulos = herdar da loja). */
export async function updateConditionalOverride(
  userId: string,
  override: ConditionalOverrideValues,
  actorUserId: string | null,
) {
  const customer = await ensureConditionalCustomer(userId);
  await prisma.conditionalCustomer.update({
    where: { userId },
    data: {
      overrideEnabled: override.enabled ?? null,
      overrideMaxItems: override.maxItemsPerOrder ?? null,
      overrideMaxOrderAmount: override.maxOrderAmount ?? null,
      overrideMaxOpenOrders: override.maxOpenConditionalOrders ?? null,
      overrideMaxExposure: override.maxCustomerExposure ?? null,
    },
  });
  await recordAudit({
    event: "OVERRIDE_UPDATED",
    entity: "ConditionalCustomer",
    entityId: customer.id,
    actorUserId,
    metadata: { userId, ...override },
  });
}
