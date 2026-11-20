import "server-only";
import { randomUUID } from "node:crypto";
import type { PaymentIntent } from "@/modules/payments/types";
import { prisma } from "@/lib/db/prisma";
import { getCase, lockConditionalStore, type Actor } from "./service";
import {
  initiatePayment,
  applyPaymentStatus,
  getLatestPaymentIntent,
} from "@/modules/payments/payment.service";

export async function payConditional(actor: Actor, id: string) {
  const selected = await getCase(actor, id);
  if (selected.userId !== actor.id)
    throw new Error("Somente a cliente pode iniciar o pagamento.");
  const attempt = await prisma.$transaction(async (tx) => {
    await lockConditionalStore(tx);
    const row = await tx.conditionalCase.findUniqueOrThrow({
      where: { id },
      include: { order: true, user: true },
    });
    if (
      row.status !== "DECIDED" ||
      !row.order ||
      row.order.paymentStatus === "PAID" ||
      row.order.status !== "PENDING"
    )
      throw new Error("Não há acerto disponível para pagamento.");
    const last = await tx.payment.findFirst({
      where: { orderId: row.order.id },
      orderBy: { createdAt: "desc" },
    });
    if (last && ["PENDING", "AUTHORIZED", "PAID"].includes(last.status))
      return { existing: true, order: row.order, user: row.user, key: "" };
    // Unique persisted claim shared by simultaneous callers. initiatePayment owns provider calls.
    const marker = `conditional-payment:${row.order.id}:${last?.id ?? "first"}`;
    const event = await tx.conditionalEvent.upsert({
      where: { key: marker },
      create: {
        caseId: id,
        key: marker,
        type: "PAYMENT_ATTEMPT",
        message: "Tentativa de pagamento iniciada.",
        data: { attemptKey: randomUUID() },
      },
      update: {},
    });
    const key = (event.data as { attemptKey: string }).attemptKey;
    return { existing: false, order: row.order, user: row.user, key };
  });
  if (attempt.existing) {
    const latest = await getLatestPaymentIntent(attempt.order.id);
    return safePayment(latest?.intent ?? null);
  }
  const { intent } = await initiatePayment({
    orderId: attempt.order.id,
    amount: Number(attempt.order.grandTotal),
    currency: attempt.order.currency,
    method: "PIX",
    customer: { name: attempt.user.name ?? "Cliente", email: attempt.user.email },
    idempotencyKey: attempt.key,
  });
  if (intent.status === "PAID")
    await applyPaymentStatus({
      providerId: (
        await prisma.payment.findFirstOrThrow({
          where: { orderId: attempt.order.id, idempotencyKey: attempt.key },
        })
      ).provider,
      providerPaymentId: intent.providerPaymentId,
      status: "PAID",
      source: "sync",
      eventType: "conditional_payment",
    });
  return safePayment(intent);
}
function safePayment(intent: PaymentIntent | null) {
  return intent
    ? {
        status: intent.status,
        qrCode: intent.qrCode ?? null,
        ticketUrl: intent.ticketUrl ?? null,
      }
    : null;
}
