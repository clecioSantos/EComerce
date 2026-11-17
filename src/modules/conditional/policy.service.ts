import "server-only";

import type { ReturnShippingPolicy } from "@/generated/prisma/enums";

import { recordAudit } from "./audit.service";
import { prisma, type ConditionalDb } from "./db";
import { DEFAULT_CONDITIONAL_POLICY, resolveEffectivePolicy } from "./policy";
import type { ConditionalOverrideValues, ConditionalPolicyValues } from "./types";

export interface ConditionalPolicyRecord extends ConditionalPolicyValues {
  returnShippingPolicy: ReturnShippingPolicy;
  returnShippingMinPurchase: number | null;
  returnShippingAmount: number | null;
}

export function storePolicyValues(
  record: ConditionalPolicyRecord,
): ConditionalPolicyValues {
  return {
    enabled: record.enabled,
    maxItemsPerOrder: record.maxItemsPerOrder,
    maxOrderAmount: record.maxOrderAmount,
    maxOpenConditionalOrders: record.maxOpenConditionalOrders,
    maxCustomerExposure: record.maxCustomerExposure,
    decisionDeadlineDays: record.decisionDeadlineDays,
  };
}

interface PolicyRow {
  enabled: boolean;
  maxItemsPerOrder: number;
  maxOrderAmount: { toString(): string };
  maxOpenConditionalOrders: number;
  maxCustomerExposure: { toString(): string };
  decisionDeadlineDays: number;
  returnShippingPolicy: ReturnShippingPolicy;
  returnShippingMinPurchase: { toString(): string } | null;
  returnShippingAmount: { toString(): string } | null;
}

function toRecord(row: PolicyRow): ConditionalPolicyRecord {
  return {
    enabled: row.enabled,
    maxItemsPerOrder: row.maxItemsPerOrder,
    maxOrderAmount: Number(row.maxOrderAmount),
    maxOpenConditionalOrders: row.maxOpenConditionalOrders,
    maxCustomerExposure: Number(row.maxCustomerExposure),
    decisionDeadlineDays: row.decisionDeadlineDays,
    returnShippingPolicy: row.returnShippingPolicy,
    returnShippingMinPurchase:
      row.returnShippingMinPurchase == null
        ? null
        : Number(row.returnShippingMinPurchase),
    returnShippingAmount:
      row.returnShippingAmount == null ? null : Number(row.returnShippingAmount),
  };
}

export async function getStorePolicyRecord(
  db: ConditionalDb = prisma,
): Promise<ConditionalPolicyRecord> {
  const row = await db.conditionalPurchasePolicy.findUnique({
    where: { id: "default" },
  });
  if (!row) {
    return {
      ...DEFAULT_CONDITIONAL_POLICY,
      returnShippingPolicy: "FREE",
      returnShippingMinPurchase: null,
      returnShippingAmount: null,
    };
  }
  return toRecord(row);
}

export async function getStorePolicy(
  db: ConditionalDb = prisma,
): Promise<ConditionalPolicyValues> {
  return storePolicyValues(await getStorePolicyRecord(db));
}

export async function upsertStorePolicy(
  input: ConditionalPolicyRecord,
  actorUserId?: string | null,
): Promise<void> {
  await prisma.conditionalPurchasePolicy.upsert({
    where: { id: "default" },
    create: { id: "default", ...input },
    update: input,
  });
  await recordAudit({
    event: "POLICY_UPDATED",
    entity: "ConditionalPurchasePolicy",
    entityId: "default",
    actorUserId,
    metadata: {
      enabled: input.enabled,
      maxItemsPerOrder: input.maxItemsPerOrder,
      maxOrderAmount: input.maxOrderAmount,
      maxCustomerExposure: input.maxCustomerExposure,
      maxOpenConditionalOrders: input.maxOpenConditionalOrders,
      decisionDeadlineDays: input.decisionDeadlineDays,
    },
  });
}

export function overrideFromCustomerRow(row: {
  overrideEnabled?: unknown;
  overrideMaxItems?: unknown;
  overrideMaxOrderAmount?: unknown;
  overrideMaxOpenOrders?: unknown;
  overrideMaxExposure?: unknown;
}): ConditionalOverrideValues {
  const num = (value: unknown): number | null =>
    value == null ? null : Number(value as number);
  return {
    enabled: row.overrideEnabled == null ? null : Boolean(row.overrideEnabled),
    maxItemsPerOrder: num(row.overrideMaxItems),
    maxOrderAmount: num(row.overrideMaxOrderAmount),
    maxOpenConditionalOrders: num(row.overrideMaxOpenOrders),
    maxCustomerExposure: num(row.overrideMaxExposure),
  };
}

/** Política efetiva = política da loja + override do cliente. */
export async function getEffectivePolicy(
  userId: string,
  db: ConditionalDb = prisma,
): Promise<ConditionalPolicyValues> {
  const store = await getStorePolicy(db);
  const customer = await db.conditionalCustomer.findUnique({ where: { userId } });
  if (!customer) return store;
  return resolveEffectivePolicy(store, overrideFromCustomerRow(customer));
}
