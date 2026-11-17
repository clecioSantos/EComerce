import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { isUniqueConstraintError } from "@/lib/db/errors";
import { prisma } from "@/lib/db/prisma";
import { getRequestId } from "@/lib/request-context";
import { closeCart } from "@/modules/cart/cart.service";
import { reserveStock } from "@/modules/inventory/inventory.service";
import { generateOrderNumber } from "@/modules/orders/order";
import type { ShippingAddressSnapshot } from "@/modules/orders/schemas";
import { consumeCoupon } from "@/modules/promotions/promotion.service";
import { multiplyMoney, roundMoney } from "@/modules/pricing/engine";

import { recordAudit } from "./audit.service";
import { evaluateConditionalEligibility } from "./eligibility";
import { isProductConditionalEligible } from "./eligibility.service";
import { ConditionalEligibilityError } from "./errors";
import { getCustomerExposure, getOpenConditionalOrders } from "./exposure.service";
import {
  getStorePolicyRecord,
  overrideFromCustomerRow,
  storePolicyValues,
} from "./policy.service";
import { resolveEffectivePolicy } from "./policy";
import { hasAcceptedActiveTerm } from "./term.service";
import type { ConditionalEligibilityCode } from "./types";

export interface ConditionalOrderLineInput {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  attributesSnapshot: { attributeName: string; value: string }[];
  imageUrl: string | null;
}

export interface CreateConditionalOrderInput {
  userId: string;
  customer: { name: string; email: string; phone?: string | null };
  shippingAddress: ShippingAddressSnapshot;
  billingAddress?: ShippingAddressSnapshot | null;
  lines: ConditionalOrderLineInput[];
  shipping: {
    provider: string;
    method: string;
    serviceId?: string | null;
    company?: string | null;
    estimatedDaysMin?: number | null;
    estimatedDaysMax?: number | null;
    snapshot?: unknown;
  };
  totals: {
    subtotal: number;
    discountTotal: number;
    shippingTotal: number;
    taxTotal?: number;
    grandTotal: number;
    currency: string;
  };
  coupon?: { id: string; code: string } | null;
  cartId?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  requestHash?: string | null;
}

export interface ConditionalOrderResult {
  orderId: string;
  orderNumber: string;
  conditionalPurchaseId: string;
  status: string;
}

interface LockedCustomerRow {
  id: string;
  status: string;
  overrideEnabled: unknown;
  overrideMaxItems: unknown;
  overrideMaxOrderAmount: unknown;
  overrideMaxOpenOrders: unknown;
  overrideMaxExposure: unknown;
  [key: string]: unknown;
}

/**
 * Cria um pedido de Compra Condicional de forma atômica:
 * lock do cliente (serializa exposição/limites) → valida política/termo/itens/
 * estoque → reserva estoque (guarded) → cria Order (CONDITIONAL) +
 * ConditionalPurchase/items + holds → consome cupom → fecha o carrinho.
 *
 * Não há cobrança aqui (Estratégia A): o pagamento ocorre na decisão.
 */
export async function createConditionalOrder(
  input: CreateConditionalOrderInput,
): Promise<ConditionalOrderResult> {
  const requestId = await getRequestId();
  if (input.lines.length === 0) {
    throw new ConditionalEligibilityError(["EMPTY_ORDER"]);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock pessimista do cliente: serializa criação/reserva/exposição.
      const lockedRows = await tx.$queryRaw<LockedCustomerRow[]>`
        SELECT * FROM conditional_customers WHERE "userId" = ${input.userId} FOR UPDATE`;
      const locked = lockedRows[0];
      if (!locked) {
        throw new ConditionalEligibilityError(["CUSTOMER_NOT_APPROVED"]);
      }
      if (locked.status !== "APPROVED") {
        const code: ConditionalEligibilityCode =
          locked.status === "SUSPENDED"
            ? "CUSTOMER_SUSPENDED"
            : locked.status === "REJECTED"
              ? "CUSTOMER_REJECTED"
              : "CUSTOMER_NOT_APPROVED";
        throw new ConditionalEligibilityError([code]);
      }

      // 2. Política efetiva (loja + override).
      const storeRecord = await getStorePolicyRecord(tx);
      const policy = resolveEffectivePolicy(
        storePolicyValues(storeRecord),
        overrideFromCustomerRow(locked),
      );

      // 3. Itens reais (preço/estoque/elegibilidade) — backend é a verdade.
      const variantIds = input.lines.map((line) => line.variantId);
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true, inventory: true },
      });
      const byId = new Map(variants.map((variant) => [variant.id, variant]));
      const evalItems = input.lines.map((line) => {
        const variant = byId.get(line.variantId);
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
          unitPrice: line.unitPrice,
          eligible,
          availableStock,
        };
      });

      // 4. Agregados + termo + motor de elegibilidade.
      const currentExposure = await getCustomerExposure(input.userId, tx);
      const openConditionalOrders = await getOpenConditionalOrders(input.userId, tx);
      const termAccepted = await hasAcceptedActiveTerm(input.userId, tx);

      const evaluation = evaluateConditionalEligibility({
        policy,
        customerStatus: "APPROVED",
        termAccepted,
        items: evalItems,
        currentExposure,
        openConditionalOrders,
      });
      if (!evaluation.allowed) {
        throw new ConditionalEligibilityError(evaluation.reasons);
      }

      const term = await tx.conditionalTerm.findFirst({
        where: { active: true },
        orderBy: { version: "desc" },
      });

      // 5. Pedido + itens.
      const order = await tx.order.create({
        data: {
          number: generateOrderNumber(),
          userId: input.userId,
          type: "CONDITIONAL",
          status: "PENDING",
          paymentStatus: "PENDING",
          customerName: input.customer.name,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone ?? null,
          subtotal: input.totals.subtotal,
          discountTotal: input.totals.discountTotal,
          shippingTotal: input.totals.shippingTotal,
          taxTotal: input.totals.taxTotal ?? 0,
          grandTotal: input.totals.grandTotal,
          currency: input.totals.currency,
          couponId: input.coupon?.id ?? null,
          couponCode: input.coupon?.code ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          requestHash: input.requestHash ?? null,
          cartId: input.cartId ?? null,
          shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
          billingAddress: (input.billingAddress ??
            undefined) as unknown as Prisma.InputJsonValue,
          shippingProvider: input.shipping.provider,
          shippingMethod: input.shipping.method,
          shippingServiceId: input.shipping.serviceId ?? null,
          shippingCompany: input.shipping.company ?? null,
          shippingEstimatedDaysMin: input.shipping.estimatedDaysMin ?? null,
          shippingEstimatedDaysMax: input.shipping.estimatedDaysMax ?? null,
          shippingSnapshot: (input.shipping.snapshot ??
            undefined) as unknown as Prisma.InputJsonValue,
          notes: input.notes ?? null,
          items: {
            create: input.lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              productName: line.productName,
              variantName: line.variantName,
              sku: line.sku,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              total: multiplyMoney(line.unitPrice, line.quantity),
              discountTotal: line.discount,
              attributesSnapshot:
                line.attributesSnapshot as unknown as Prisma.InputJsonValue,
              imageUrl: line.imageUrl,
            })),
          },
        },
        include: { items: true },
      });

      // 6. Compra condicional + snapshot de política/termo.
      const conditionalPurchase = await tx.conditionalPurchase.create({
        data: {
          orderId: order.id,
          status: "PENDING_APPROVAL",
          termId: term?.id ?? null,
          termVersion: term?.version ?? null,
          termAcceptedAt: term ? new Date() : null,
          policySnapshot: policy as unknown as Prisma.InputJsonValue,
          exposureAmount: roundMoney(evaluation.orderAmount),
        },
      });

      // 7. Reserva atômica + hold de longo prazo + item condicional.
      for (const line of input.lines) {
        const orderItem = order.items.find((item) => item.variantId === line.variantId);
        if (!orderItem) throw new Error("Item do pedido não encontrado.");

        await reserveStock(line.variantId, line.quantity, order.id, tx);

        const conditionalItem = await tx.conditionalPurchaseItem.create({
          data: {
            conditionalPurchaseId: conditionalPurchase.id,
            orderItemId: orderItem.id,
            status: "PENDING_DECISION",
          },
        });

        await tx.conditionalStockHold.create({
          data: {
            conditionalPurchaseId: conditionalPurchase.id,
            conditionalItemId: conditionalItem.id,
            variantId: line.variantId,
            quantity: line.quantity,
            status: "ACTIVE",
          },
        });
      }

      // 8. Cupom (atômico) + fechamento do carrinho.
      if (input.coupon) {
        await consumeCoupon(tx, {
          couponId: input.coupon.id,
          orderId: order.id,
          userId: input.userId,
        });
      }
      if (input.cartId) {
        await closeCart(tx, input.cartId);
      }

      return {
        orderId: order.id,
        orderNumber: order.number,
        conditionalPurchaseId: conditionalPurchase.id,
        status: conditionalPurchase.status,
      };
    });

    await recordAudit({
      event: "CONDITIONAL_ORDER_CREATED",
      entity: "ConditionalPurchase",
      entityId: result.conditionalPurchaseId,
      actorUserId: input.userId,
      metadata: {
        requestId,
        orderId: result.orderId,
        lines: input.lines.length,
      },
    });

    return result;
  } catch (error) {
    if (input.idempotencyKey && isUniqueConstraintError(error)) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { conditionalPurchase: true },
      });
      if (existing) {
        if (
          existing.requestHash &&
          input.requestHash &&
          existing.requestHash !== input.requestHash
        ) {
          throw new Error("Idempotency-Key reutilizada com um payload diferente.");
        }
        return {
          orderId: existing.id,
          orderNumber: existing.number,
          conditionalPurchaseId: existing.conditionalPurchase?.id ?? "",
          status: existing.conditionalPurchase?.status ?? "PENDING_APPROVAL",
        };
      }
    }
    throw error;
  }
}
