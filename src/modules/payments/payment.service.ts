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
  CardPaymentDetails,
  PayerDetails,
  PaymentIntent,
  PaymentIntentStatus,
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
  card?: CardPaymentDetails;
  payer?: PayerDetails;
  /** Chave da tentativa de pagamento (idempotência). */
  idempotencyKey?: string | null;
}

export function paymentToIntent(payment: Payment): PaymentIntent {
  const raw = (payment.metadata ?? null) as Record<string, unknown> | null;
  const transactionData = (
    raw?.point_of_interaction as
      { transaction_data?: Record<string, unknown> } | undefined
  )?.transaction_data;
  return {
    providerPaymentId: payment.providerPaymentId ?? "",
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    qrCode: (transactionData?.qr_code as string | undefined) ?? undefined,
    qrCodeBase64: (transactionData?.qr_code_base64 as string | undefined) ?? undefined,
    ticketUrl: (transactionData?.ticket_url as string | undefined) ?? undefined,
    expiresAt: (raw?.date_of_expiration as string | undefined) ?? undefined,
    raw: payment.metadata ?? undefined,
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
      idempotencyKey: input.idempotencyKey ?? null,
      card: input.card,
      payer: input.payer,
    });

    const payment = claimed
      ? await prisma.payment.update({
          where: { id: claimed.id },
          data: {
            providerPaymentId: intent.providerPaymentId,
            status: intent.status,
            metadata: (intent.raw ?? undefined) as Prisma.InputJsonValue | undefined,
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
            metadata: (intent.raw ?? undefined) as Prisma.InputJsonValue | undefined,
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

/** Último pagamento do pedido convertido para `PaymentIntent` (com QR, se PIX). */
export async function getLatestPaymentIntent(
  orderId: string,
): Promise<{ payment: Payment; intent: PaymentIntent } | null> {
  const payment = await prisma.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return null;
  return { payment, intent: paymentToIntent(payment) };
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
 * Aplica um status de pagamento vindo do provedor de forma idempotente e
 * transacional. É a ÚNICA fonte de transição de pagamento/pedido:
 * webhook, reconciliação e retorno síncrono convergem para cá.
 *
 * - quando `externalEventId` é informado, cria um `PaymentEvent` na MESMA
 *   transação (unicidade provider+evento garante dedupe);
 * - transições inválidas são registradas como FAILED sem alterar o negócio;
 * - `from === to` é no-op (reenvio idempotente);
 * - falha de consulta NUNCA vira pagamento aprovado.
 */
export interface ApplyPaymentStatusInput {
  providerId: string;
  providerPaymentId?: string | null;
  status?: PaymentIntentStatus | null;
  externalEventId?: string | null;
  eventType?: string;
  payload?: unknown;
  source?: "webhook" | "reconciliation" | "sync";
}

export interface ApplyPaymentStatusResult {
  handled: boolean;
  duplicate: boolean;
  rejected?: boolean;
  reason?: string;
  orderId?: string;
  providerPaymentId?: string;
  status?: PaymentIntentStatus;
}

export async function applyPaymentStatus(
  input: ApplyPaymentStatusInput,
): Promise<ApplyPaymentStatusResult> {
  const {
    providerId,
    providerPaymentId,
    status,
    externalEventId,
    eventType = "unknown",
  } = input;
  const requestId = await getRequestId();
  const eventWhere = externalEventId
    ? { provider_externalEventId: { provider: providerId, externalEventId } }
    : null;

  if (!providerPaymentId || !status) {
    return { handled: false, duplicate: false };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (externalEventId && eventWhere) {
        await tx.paymentEvent.create({
          data: {
            provider: providerId,
            externalEventId,
            eventType,
            payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
            status: "PROCESSING",
          },
        });
      }

      const markProcessed = async () => {
        if (!eventWhere) return;
        await tx.paymentEvent.update({
          where: eventWhere,
          data: { status: "PROCESSED", processedAt: new Date() },
        });
      };

      const payment = await tx.payment.findFirst({
        where: { provider: providerId, providerPaymentId },
      });
      if (!payment) {
        await markProcessed();
        return { handled: false, duplicate: false, providerPaymentId, status };
      }

      const validation = validatePaymentTransition(payment.status, status);
      if (!validation.valid) {
        if (eventWhere) {
          await tx.paymentEvent.update({
            where: eventWhere,
            data: { status: "FAILED", processedAt: new Date() },
          });
        }
        logEvent("WEBHOOK_REJECTED", {
          requestId,
          provider: providerId,
          externalEventId: externalEventId ?? undefined,
          reason: validation.error,
        });
        return {
          handled: true,
          duplicate: false,
          rejected: true,
          reason: validation.error,
          orderId: payment.orderId,
          providerPaymentId,
          status,
        };
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { status },
      });

      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
      });
      if (order) {
        if (status === "PAID") {
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
            data: { paymentStatus: status },
          });
        }
      }

      await markProcessed();

      if (status === "PAID") {
        logEvent("PAYMENT_APPROVED", {
          requestId,
          provider: providerId,
          paymentId: payment.id,
          orderId: payment.orderId,
        });
      } else if (status === "FAILED") {
        logEvent("PAYMENT_FAILED", {
          requestId,
          provider: providerId,
          paymentId: payment.id,
          orderId: payment.orderId,
        });
      } else if (status === "REFUNDED") {
        logEvent("PAYMENT_REFUNDED", {
          requestId,
          provider: providerId,
          paymentId: payment.id,
          orderId: payment.orderId,
        });
      }

      return {
        handled: true,
        duplicate: false,
        orderId: payment.orderId,
        providerPaymentId,
        status,
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      logEvent("WEBHOOK_DUPLICATE", {
        requestId,
        provider: providerId,
        externalEventId: externalEventId ?? undefined,
      });
      return {
        handled: true,
        duplicate: true,
        providerPaymentId,
        status,
      };
    }
    throw error;
  }
}

/**
 * Processa um webhook de pagamento: delega ao provider (que consulta o estado
 * real no Mercado Pago) e aplica via `applyPaymentStatus`.
 */
export async function handlePaymentWebhook(providerId: string, payload: WebhookPayload) {
  const provider = getPaymentProvider(providerId);
  const result = await provider.handleWebhook(payload);
  const externalEventId = resolveExternalEventId(payload);
  const requestId = await getRequestId();

  logEvent("WEBHOOK_RECEIVED", {
    requestId,
    provider: providerId,
    externalEventId,
    providerEvent: payload.event,
  });

  return applyPaymentStatus({
    providerId,
    providerPaymentId: result.providerPaymentId,
    status: result.status,
    externalEventId,
    eventType: payload.event || "unknown",
    payload: payload.raw,
    source: "webhook",
  });
}
