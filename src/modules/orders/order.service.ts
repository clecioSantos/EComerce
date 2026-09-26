import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { isUniqueConstraintError } from "@/lib/db/errors";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-context";
import {
  consumeStock,
  releaseStock,
  reserveStock,
  restockStock,
  type DbClient,
} from "@/modules/inventory/inventory.service";
import {
  createReservation,
  listActiveReservationsForOrder,
  markReservationConsumed,
  markReservationReleased,
} from "@/modules/inventory/reservation.service";
import { multiplyMoney } from "@/modules/pricing/engine";
import { consumeCoupon } from "@/modules/promotions/promotion.service";

import { assertOrderTransition, generateOrderNumber } from "./order";
import type { ShippingAddressSnapshot } from "./schemas";

export interface OrderLineInput {
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

export interface CreateOrderInput {
  userId?: string | null;
  customer: { name: string; email: string; phone?: string | null };
  shippingAddress: ShippingAddressSnapshot;
  billingAddress?: ShippingAddressSnapshot | null;
  lines: OrderLineInput[];
  totals: {
    subtotal: number;
    discountTotal: number;
    shippingTotal: number;
    taxTotal?: number;
    grandTotal: number;
    currency: string;
  };
  shipping: {
    provider: string;
    method: string;
    serviceId?: string | null;
    company?: string | null;
    estimatedDaysMin?: number | null;
    estimatedDaysMax?: number | null;
    /** Snapshot serializável da opção selecionada. */
    snapshot?: unknown;
  };
  coupon?: { id: string; code: string } | null;
  cartId?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  requestHash?: string | null;
}

const PAID_LIKE_STATUSES: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];

/**
 * Cria o pedido com snapshot dos produtos, reserva estoque atomicamente
 * (criando StockReservation), consome cupom e limpa o carrinho — tudo em uma
 * única transação. Qualquer falha faz rollback completo.
 *
 * IMPORTANTE: preço/estoque NUNCA vêm do cliente; `input.lines` e `input.totals`
 * são recalculados no servidor (checkout.service) antes de chamar esta função.
 */
export async function createOrder(input: CreateOrderInput) {
  const requestId = await getRequestId();
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Criar o pedido (PENDING) com os itens (snapshot).
      const order = await tx.order.create({
        data: {
          number: generateOrderNumber(),
          userId: input.userId ?? null,
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

      // 2. Reservar estoque de forma atômica e registrar a reserva explícita.
      for (const line of input.lines) {
        await reserveStock(line.variantId, line.quantity, order.id, tx);
        await createReservation(tx, {
          orderId: order.id,
          variantId: line.variantId,
          quantity: line.quantity,
        });
      }

      // 3. Consumir o cupom de forma atômica (dentro desta transação).
      if (input.coupon) {
        await consumeCoupon(tx, {
          couponId: input.coupon.id,
          orderId: order.id,
          userId: input.userId ?? null,
        });
      }

      // 4. Fechar o carrinho.
      if (input.cartId) {
        await tx.cartItem.deleteMany({ where: { cartId: input.cartId } });
        await tx.cart.update({
          where: { id: input.cartId },
          data: { status: "CONVERTED" },
        });
      }

      logEvent("ORDER_CREATED", {
        requestId,
        userId: input.userId ?? null,
        orderId: order.id,
        total: input.totals.grandTotal,
        lines: input.lines.length,
      });
      logEvent("STOCK_RESERVED", {
        requestId,
        orderId: order.id,
        lines: input.lines.length,
      });

      return order;
    });
  } catch (error) {
    // Concorrência: duas requisições com a mesma chave. A perdedora recebe
    // violação de unicidade e aqui devolvemos o pedido já criado.
    if (input.idempotencyKey && isUniqueConstraintError(error)) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true },
      });
      if (existing) {
        if (
          existing.requestHash &&
          input.requestHash &&
          existing.requestHash !== input.requestHash
        ) {
          throw new Error("Idempotency-Key reutilizada com um payload diferente.");
        }
        return existing;
      }
    }
    throw error;
  }
}

/**
 * Consome as reservas ativas do pedido e marca como PAID. Deve rodar dentro de
 * uma transação (recebe `tx`). Idempotente e com transição validada.
 */
export async function consumeOrderReservations(
  tx: DbClient,
  orderId: string,
): Promise<void> {
  const requestId = await getRequestId();
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Pedido não encontrado.");
  if (order.status === "PAID") return; // idempotente

  assertOrderTransition(order.status, "PAID");

  const reservations = await listActiveReservationsForOrder(tx, orderId);
  for (const reservation of reservations) {
    await consumeStock(reservation.variantId, reservation.quantity, order.id, tx);
    await markReservationConsumed(tx, reservation.id);
  }

  await tx.order.update({
    where: { id: orderId },
    data: { status: "PAID", paymentStatus: "PAID" },
  });

  logEvent("STOCK_CONSUMED", {
    requestId,
    orderId,
    lines: reservations.length,
  });
}

/**
 * Pagamento aprovado: consome as reservas ativas e marca o pedido como PAID.
 */
export async function confirmOrderPayment(orderId: string) {
  return prisma.$transaction(async (tx) => {
    await consumeOrderReservations(tx, orderId);
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  });
}

/**
 * Cancelamento:
 * - PENDING -> RELEASE das reservas ativas (volta ao disponível).
 * - PAID/PROCESSING/SHIPPED/DELIVERED -> RESTOCK do físico (reservas já consumidas).
 * Idempotente e com transição validada.
 */
export async function cancelOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status === "CANCELED") return order; // idempotente

    assertOrderTransition(order.status, "CANCELED");

    const requestId = await getRequestId();
    const wasPaidLike = PAID_LIKE_STATUSES.includes(order.status);

    if (!wasPaidLike) {
      const reservations = await listActiveReservationsForOrder(tx, order.id);
      for (const reservation of reservations) {
        await releaseStock(reservation.variantId, reservation.quantity, order.id, tx);
        await markReservationReleased(tx, reservation.id);
      }
      logEvent("STOCK_RELEASED", {
        requestId,
        orderId,
        lines: reservations.length,
      });
    } else {
      for (const item of order.items) {
        if (!item.variantId) {
          throw new Error(
            `Item ${item.sku} sem variante vinculada; não é possível devolver estoque automaticamente.`,
          );
        }
        await restockStock(item.variantId, item.quantity, order.id, tx);
      }
      logEvent("STOCK_RESTOCKED", {
        requestId,
        orderId,
        lines: order.items.length,
      });
    }

    const cancelled = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELED" },
    });
    logEvent("ORDER_CANCELLED", { requestId, orderId });
    return cancelled;
  });
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Pedido não encontrado.");
  if (status === "CANCELED") return cancelOrder(orderId);
  if (status === "PAID") return confirmOrderPayment(orderId);
  if (status === "REFUNDED") {
    throw new Error("Reembolso deve ser realizado pelo fluxo de refund (refundOrder).");
  }
  assertOrderTransition(order.status, status);
  return prisma.order.update({ where: { id: orderId }, data: { status } });
}

const orderInclude = {
  items: true,
  payments: true,
  coupon: true,
} satisfies Prisma.OrderInclude;

export async function getOrderById(orderId: string, userId?: string) {
  return prisma.order.findFirst({
    where: { id: orderId, ...(userId ? { userId } : {}) },
    include: orderInclude,
  });
}

export async function getOrderByNumber(number: string) {
  return prisma.order.findUnique({
    where: { number },
    include: orderInclude,
  });
}

export async function listUserOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllOrders(status?: OrderStatus) {
  return prisma.order.findMany({
    where: status ? { status } : undefined,
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getOrderCount() {
  return prisma.order.count();
}

export async function getRevenueTotal() {
  const result = await prisma.order.aggregate({
    where: { paymentStatus: "PAID" },
    _sum: { grandTotal: true },
  });
  return Number(result._sum.grandTotal ?? 0);
}
