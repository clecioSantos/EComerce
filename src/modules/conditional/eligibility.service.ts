import "server-only";

import { prisma } from "@/lib/db/prisma";

import { getConditionalCustomer } from "./customer.service";
import { evaluateConditionalEligibility } from "./eligibility";
import { getCustomerExposure, getOpenConditionalOrders } from "./exposure.service";
import { getEffectivePolicy } from "./policy.service";
import { hasAcceptedActiveTerm } from "./term.service";
import type { ConditionalEligibilityResult, ConditionalPolicyValues } from "./types";

/**
 * Elegibilidade do produto para Compra Condicional. Guardada em
 * `Product.metadata.conditionalPurchase` (evita acoplar um campo rígido agora;
 * pode evoluir para coluna dedicada sem quebrar o domínio).
 */
export function isProductConditionalEligible(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>).conditionalPurchase === true;
}

export interface ConditionalEvaluation {
  result: ConditionalEligibilityResult;
  policy: ConditionalPolicyValues;
  termAccepted: boolean;
}

/**
 * Avalia a Compra Condicional para um cliente e um conjunto de itens.
 * Combina política efetiva + status do cliente + termo + itens (elegibilidade e
 * estoque consultados no banco) + exposição/abertos atuais. Nunca confia no
 * frontend.
 */
export async function evaluateConditionalPurchase(params: {
  userId: string;
  lines: { variantId: string; quantity: number }[];
}): Promise<ConditionalEvaluation> {
  const policy = await getEffectivePolicy(params.userId);
  const customer = await getConditionalCustomer(params.userId);
  const termAccepted = await hasAcceptedActiveTerm(params.userId);

  const variantIds = params.lines.map((line) => line.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true, inventory: true },
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  const items = params.lines.map((line) => {
    const variant = byId.get(line.variantId);
    const unitPrice = variant ? Number(variant.price ?? variant.product.basePrice) : 0;
    const availableStock =
      variant?.inventory != null
        ? variant.inventory.quantityOnHand - variant.inventory.quantityReserved
        : 0;
    const eligible = variant
      ? variant.isActive &&
        variant.product.status === "ACTIVE" &&
        isProductConditionalEligible(variant.product.metadata)
      : false;
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice,
      eligible,
      availableStock,
    };
  });

  const currentExposure = await getCustomerExposure(params.userId);
  const openConditionalOrders = await getOpenConditionalOrders(params.userId);

  const result = evaluateConditionalEligibility({
    policy,
    customerStatus: customer?.status ?? null,
    termAccepted,
    items,
    currentExposure,
    openConditionalOrders,
  });

  return { result, policy, termAccepted };
}
