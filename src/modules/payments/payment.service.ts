import "server-only";

import type { Payment } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";
import { isUniqueConstraintError } from "@/lib/db/errors";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-context";
import { restockStock } from "@/modules/inventory/inventory.service";
import { consumeOrderReservations } from "@/modules/orders/order.service";
import { validateOrderTransition } from "@/modules/orders/order";

import { resolveExternalEventId } from "./events";
import { getPaymentProvider } from "./registry";
import { assertPaymentTransition, validatePaymentTransition } from "./state";
import type {
  PaymentIntent,
  PaymentMethodKind,
  WebhookPayload,
} from "./types";

export interface InitiatePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethodKind;
  customer: { name: string; email: string };
  metadata?: Record<string, unknown>;
  /** Chave da tentativa de pagamento (idempotência). */
  idempotencyKey?: string | null;
}

function paymentToIntent(payment: Payment): PaymentIntent {
  return {
    providerPaymentId: payment.providerPaymentId ?? "",
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
  };
}

export async function initiatePayment(input: InitiatePaymentInput) {
  const provider = getPaymentProvider(getEnv().PAYMENT_PROVIDER);

  // Idempotência da tentativa: se a chave já existe para o pedido, devolve.
  if (input.idempotencyKey) {
    const existing = await prisma.payment.findFirst({
      where: { orderId: input.orderId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { payment: existing, intent: paymentToIntent(existing) };
    }
  }

  // Claim atômico antes de chamar o provedor: evita cobrança duplicada por
  // requisições concorrentes com a mesma chave de tentativa.
  let claimed: Payment | null = null;
  if (input.idempotencyKey) {
    try {
      claimed = await prisma.payment.create({
        data: {
          orderId: input.orderId,
          provider: provider.id,
          idempotencyKey: input.idempotencyKey,
          method: input.method,
          status: "PENDING",
          amount: input.amount,
          currency: input.currency,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await prisma.payment.findFirst({
          where: {
            orderId: input.orderId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        if (existing) {
          return { payment: existing, intent: paymentToIntent(existing) };
        }
      }
      throw error;
    }
  }

  try {
    const intent = await provider.createPayment({
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      customer: input.customer,
      metadata: input.metadata,
    });

    const payment = claimed
      ? await prisma.payment.update({
          where: { id: claimed.id },
          data: {
            providerPaymentId: intent.providerPaymentId,
            status: intent.status,
            metadata: (intent.raw ??
              undefined) as Prisma.InputJsonValue | undefined,
            transactions: {
              create: {
                type: "CHARGE",
                status: intent.status,
                amount: input.amount,
                providerTransactionId: intent.providerPaymentId,
              },
            },
          },
        })
      : await prisma.payment.create({
          data: {
            orderId: input.orderId,
            provider: provider.id,
            providerPaymentId: intent.providerPaymentId,
            method: input.method,
            status: intent.status,
            amount: input.amount,
            currency: input.currency,
            metadata: (intent.raw ??
              undefined) as Prisma.InputJsonValue | undefined,
            transactions: {
              create: {
                type: "CHARGE",
                status: intent.status,
                amount: input.amount,
                providerTransactionId: intent.providerPaymentId,
              },
            },
          },
        });

    await prisma.order.update({
      where: { id: input.orderId },
      data: { paymentStatus: intent.status },
    });

    logEvent("PAYMENT_CREATED", {
      requestId: await getRequestId(),
      orderId: input.orderId,
      paymentId: payment.id,
      provider: provider.id,
      method: input.method,
      amount: input.amount,
    });

    return { payment, intent };
  } catch (error) {
    // Libera o claim para permitir retry legítimo.
    if (claimed) {
      await prisma.payment.delete({ where: { id: claimed.id } }).catch(() => {});
    }
    throw error;
  }
}

export async function getPaymentStatus(
  providerId: string,
  providerPaymentId: string,
): Promise<PaymentIntent | null> {
  return getPaymentProvider(providerId).getPaymentStatus(providerPaymentId);
}

/**
 * Reembolso consistente e idempotente:
 * valida estados -> processa no provedor -> registra transação -> RESTOCK ->
 * atualiza pedido/pagamento (tudo transacional na parte de banco).
 * Nunca usa RELEASE (o estoque já foi consumido).
 */
export async function refundPayment(params: {
  paymentId: string;
  amount?: number;
  reason?: string;
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: { order: { include: { items: true } } },
  });
  if (!payment) throw new Error("Pagamento não encontrado.");
  if (payment.status === "REFUNDED") {
    return { amount: Number(payment.amount), alreadyRefunded: true };
  }
  if (!payment.providerPaymentId) {
    throw new Error("Pagamento sem identificador no provedor.");
  }

  const order = payment.order;
  const orderValidation = validateOrderTransition(order.status, "REFUNDED");
  if (!orderValidation.valid) throw new Error(orderValidation.error);
  assertPaymentTransition(payment.status, "REFUNDED");

  const provider = getPaymentProvider(payment.provider);
  const providerRefund = await provider.refund({
    providerPaymentId: payment.providerPaymentId,
    amount: params.amount,
    reason: params.reason,
  });

  const refundAmount = params.amount ?? Number(payment.amount);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        transactions: {
          create: {
            type: "REFUND",
            status: "REFUNDED",
            amount: refundAmount,
            providerTransactionId: providerRefund.providerTransactionId,
          },
        },
      },
    });

    for (const item of order.items) {
      if (!item.variantId) {
        throw new Error(
          `Item ${item.sku} sem variante vinculada; não é possível restaurar estoque.`,
        );
      }
      await restockStock(item.variantId, item.quantity, order.id, tx);
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
    });
  });

  logEvent("PAYMENT_REFUNDED", {
    requestId: await getRequestId(),
    paymentId: payment.id,
    orderId: order.id,
    provider: payment.provider,
    amount: refundAmount,
  });

  return { amount: refundAmount, alreadyRefunded: false };
}

/** Reembolsa o pedido a partir do pagamento aprovado (ou já reembolsado). */
export async function refundOrder(orderId: string, reason?: string) {
  const payment = await prisma.payment.findFirst({
    where: { orderId, status: { in: ["PAID", "REFUNDED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) throw new Error("Nenhum pagamento aprovado para reembolsar.");
  return refundPayment({ paymentId: payment.id, reason });
}

/**
 * Processa um webhook de pagamento de forma idempotente e transacional.
 *
 * O `PaymentEvent` é criado na MESMA transação das alterações de negócio:
 * - se a criação violar a unicidade (provider + externalEventId), o evento já
 *   foi processado antes -> retorna `duplicate: true` sem repetir efeitos;
 * - se o processamento falhar, tudo (incluindo o evento) sofre rollback e o
 *   webhook pode ser reenviado;
 * - transições inválidas são registradas como FAILED sem alterar o negócio.
 */
export async function handlePaymentWebhook(
  providerId: string,
  payload: WebhookPayload,
) {
  const provider = getPaymentProvider(providerId);
  const result = await provider.handleWebhook(payload);
  const externalEventId = resolveExternalEventId(payload);
  const eventWhere = { provider_externalEventId: { provider: providerId, externalEventId } };
  const requestId = await getRequestId();

  logEvent("WEBHOOK_RECEIVED", {
    requestId,
    provider: providerId,
    externalEventId,
    providerEvent: payload.event,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          provider: providerId,
          externalEventId,
          eventType: payload.event || "unknown",
          payload: (payload.raw ?? undefined) as Prisma.InputJsonValue | undefined,
          status: "PROCESSING",
        },
      });

      const markProcessed = () =>
        tx.paymentEvent.update({
          where: eventWhere,
          data: { status: "PROCESSED", processedAt: new Date() },
        });

      if (!result.providerPaymentId || !result.status) {
        await markProcessed();
        return { ...result, duplicate: false };
      }

      const payment = await tx.payment.findFirst({
        where: {
          provider: providerId,
          providerPaymentId: result.providerPaymentId,
        },
      });
      if (!payment) {
        await markProcessed();
        return { ...result, duplicate: false };
      }

      const validation = validatePaymentTransition(payment.status, result.status);
      if (!validation.valid) {
        await tx.paymentEvent.update({
          where: eventWhere,
          data: { status: "FAILED", processedAt: new Date() },
        });
        logEvent("WEBHOOK_REJECTED", {
          requestId,
          provider: providerId,
          externalEventId,
          reason: validation.error,
        });
        return {
          ...result,
          duplicate: false,
          rejected: true,
          reason: validation.error,
        };
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: result.status },
      });

      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
      });
      if (order) {
        if (result.status === "PAID") {
          if (order.status === "PENDING") {
            // Consome as reservas e marca o pedido como PAID.
            await consumeOrderReservations(tx, order.id);
          } else {
            // Pagamento aprovado após o pedido encerrado (CANCELED/EXPIRED/
            // REFUNDED): não reabre o pedido nem consome reserva já liberada.
            // Registra o pagamento para revisão/reembolso manual.
            await tx.order.update({
              where: { id: order.id },
              data: { paymentStatus: "PAID" },
            });
          }
        } else {
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: result.status },
          });
        }
      }

      await markProcessed();

      if (result.status === "PAID") {
        logEvent("PAYMENT_APPROVED", {
          requestId,
          provider: providerId,
          paymentId: payment.id,
          orderId: payment.orderId,
        });
      } else if (result.status === "FAILED") {
        logEvent("PAYMENT_FAILED", {
          requestId,
          provider: providerId,
          paymentId: payment.id,
          orderId: payment.orderId,
        });
      } else if (result.status === "REFUNDED") {
        logEvent("PAYMENT_REFUNDED", {
          requestId,
          provider: providerId,
          paymentId: payment.id,
          orderId: payment.orderId,
        });
      }

      return { ...result, duplicate: false };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      logEvent("WEBHOOK_DUPLICATE", {
        requestId,
        provider: providerId,
        externalEventId,
      });
      // Evento já processado anteriormente.
      return { ...result, duplicate: true };
    }
    throw error;
  }
}
