/**
 * Verificação de integração contra o PostgreSQL real.
 *
 * Executa os cenários críticos do núcleo transacional usando os SERVIÇOS reais
 * da aplicação (não mocks):
 *  1. Concorrência de estoque (última unidade)
 *  2. Idempotência do checkout (mesma chave, simultâneo)
 *  3. Webhook duplicado (10x)
 *  4. Pagamento aprovado após cancelamento
 *  5. Cancelamento (release) e consumo (paid)
 *  6. Expiração de reserva idempotente
 *
 * Uso: NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-transactional.ts
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { expireOverdueReservations } from "../src/modules/inventory/expiration.service";
import { applyInventoryMovement } from "../src/modules/inventory/inventory.service";
import { cancelOrder, createOrder } from "../src/modules/orders/order.service";
import { handlePaymentWebhook } from "../src/modules/payments/payment.service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL ausente");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const RUN = `verify_${Date.now()}`;
let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}`, detail ?? "");
  }
}

async function pickVariant() {
  const variant = await prisma.productVariant.findFirst({
    where: { inventory: { isNot: null } },
    include: { inventory: true, product: true },
  });
  if (!variant || !variant.inventory) throw new Error("Nenhuma variante com estoque no seed.");
  return variant;
}

function orderInput(variant: Awaited<ReturnType<typeof pickVariant>>, params: {
  idempotencyKey?: string;
  requestHash?: string;
  coupon?: { id: string; code: string } | null;
  quantity?: number;
}) {
  const quantity = params.quantity ?? 1;
  return {
    userId: null,
    customer: { name: "Teste Integração", email: "teste@integration.local", phone: null },
    shippingAddress: {
      recipient: "Teste",
      line1: "Rua A, 1",
      line2: null,
      city: "São Paulo",
      state: "SP",
      postalCode: "01000-000",
      country: "BR",
      phone: null,
    },
    billingAddress: null,
    lines: [
      {
        productId: variant.productId,
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        unitPrice: 100,
        quantity,
        discount: 0,
        attributesSnapshot: [],
        imageUrl: null,
      },
    ],
    totals: {
      subtotal: 100 * quantity,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 100 * quantity,
      currency: "BRL",
    },
    shipping: { provider: "fixed", method: "Entrega padrão" },
    coupon: params.coupon ?? null,
    cartId: null,
    notes: null,
    idempotencyKey: params.idempotencyKey ?? null,
    requestHash: params.requestHash ?? null,
  };
}

async function main() {
  const variant = await pickVariant();
  const originalOnHand = variant.inventory!.quantityOnHand;
  const originalReserved = variant.inventory!.quantityReserved;

  // -------------------------------------------------------------------------
  console.log("\n[1] Concorrência de estoque (última unidade)");
  await prisma.inventory.update({
    where: { variantId: variant.id },
    data: { quantityOnHand: 1, quantityReserved: 0, allowBackorder: false },
  });

  const attempts = await Promise.allSettled([
    applyInventoryMovement({ variantId: variant.id, type: "RESERVATION", quantity: 1 }),
    applyInventoryMovement({ variantId: variant.id, type: "RESERVATION", quantity: 1 }),
  ]);
  const ok = attempts.filter((a) => a.status === "fulfilled").length;
  const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  check("exatamente 1 reserva concorrente venceu", ok === 1, { ok });
  check("nunca reservou além do físico", inv.quantityReserved <= inv.quantityOnHand, inv);

  // reset
  await prisma.inventory.update({
    where: { variantId: variant.id },
    data: { quantityOnHand: originalOnHand, quantityReserved: originalReserved },
  });

  // -------------------------------------------------------------------------
  console.log("\n[2] Idempotência do checkout (mesma chave, simultâneo)");
  const idemKey = `${RUN}_checkout`;
  const coupon = await prisma.coupon.findFirst({ where: { code: "BEMVINDO10" } });
  const hash = `${RUN}_hash`;
  const results = await Promise.allSettled([
    createOrder(orderInput(variant, { idempotencyKey: idemKey, requestHash: hash, coupon: coupon ? { id: coupon.id, code: coupon.code } : null })),
    createOrder(orderInput(variant, { idempotencyKey: idemKey, requestHash: hash, coupon: coupon ? { id: coupon.id, code: coupon.code } : null })),
  ]);
  const orders = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof createOrder>>>).value);
  const orderIds = [...new Set(orders.map((o) => o.id))];
  const persisted = await prisma.order.findMany({ where: { idempotencyKey: idemKey } });
  check("exatamente 1 pedido persistido para a chave", persisted.length === 1, persisted.length);
  check("as duas chamadas retornam o mesmo pedido", orderIds.length === 1, orderIds);
  const reservations = persisted[0]
    ? await prisma.stockReservation.count({ where: { orderId: persisted[0].id } })
    : 0;
  check("exatamente 1 reserva para o pedido", reservations === 1, reservations);
  if (coupon) {
    const usages = persisted[0]
      ? await prisma.couponUsage.count({ where: { orderId: persisted[0].id } })
      : 0;
    check("exatamente 1 consumo de cupom", usages === 1, usages);
  }

  // -------------------------------------------------------------------------
  console.log("\n[3] Webhook duplicado (10x) + pagamento aprovado");
  const payOrder = persisted[0]!;
  const payment = await prisma.payment.create({
    data: {
      orderId: payOrder.id,
      provider: "mock",
      providerPaymentId: `${RUN}_pay`,
      method: "PIX",
      status: "PENDING",
      amount: Number(payOrder.grandTotal),
      currency: "BRL",
    },
  });
  const webhookPayload = {
    provider: "mock",
    event: "payment.updated",
    externalEventId: `${RUN}_evt`,
    providerPaymentId: payment.providerPaymentId!,
    orderId: payOrder.id,
    status: "PAID" as const,
    raw: { test: true },
  };
  for (let i = 0; i < 10; i += 1) {
    await handlePaymentWebhook("mock", webhookPayload);
  }
  const events = await prisma.paymentEvent.count({
    where: { provider: "mock", externalEventId: `${RUN}_evt` },
  });
  const paidOrder = await prisma.order.findUniqueOrThrow({ where: { id: payOrder.id } });
  const consumed = await prisma.stockReservation.count({
    where: { orderId: payOrder.id, status: "CONSUMED" },
  });
  check("exatamente 1 PaymentEvent registrado", events === 1, events);
  check("pedido marcado como PAID uma vez", paidOrder.status === "PAID", paidOrder.status);
  check("reserva consumida exatamente uma vez", consumed === 1, consumed);

  // -------------------------------------------------------------------------
  console.log("\n[4] Pagamento aprovado APÓS cancelamento");
  const cancelKey = `${RUN}_cancel`;
  const cancelTarget = await createOrder(orderInput(variant, { idempotencyKey: cancelKey, requestHash: `${RUN}_h2` }));
  const latePayment = await prisma.payment.create({
    data: {
      orderId: cancelTarget.id,
      provider: "mock",
      providerPaymentId: `${RUN}_late`,
      method: "PIX",
      status: "PENDING",
      amount: Number(cancelTarget.grandTotal),
      currency: "BRL",
    },
  });
  await cancelOrder(cancelTarget.id);
  await handlePaymentWebhook("mock", {
    provider: "mock",
    event: "payment.updated",
    externalEventId: `${RUN}_late_evt`,
    providerPaymentId: latePayment.providerPaymentId!,
    orderId: cancelTarget.id,
    status: "PAID",
    raw: { test: true },
  });
  const afterLate = await prisma.order.findUniqueOrThrow({ where: { id: cancelTarget.id } });
  const lateConsumed = await prisma.stockReservation.count({
    where: { orderId: cancelTarget.id, status: "CONSUMED" },
  });
  check("pedido cancelado NÃO volta para PAID", afterLate.status === "CANCELED", afterLate.status);
  check("reserva liberada não é consumida retroativamente", lateConsumed === 0, lateConsumed);

  // -------------------------------------------------------------------------
  console.log("\n[5] Expiração de reserva idempotente");
  const expireKey = `${RUN}_expire`;
  const expireTarget = await createOrder(orderInput(variant, { idempotencyKey: expireKey, requestHash: `${RUN}_h3` }));
  await prisma.stockReservation.updateMany({
    where: { orderId: expireTarget.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const beforeExpire = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  await expireOverdueReservations();
  const afterFirst = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  await expireOverdueReservations();
  const afterSecond = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  const expiredStatus = await prisma.stockReservation.findFirstOrThrow({
    where: { orderId: expireTarget.id },
  });
  check("primeira execução liberou o reservado", afterFirst.quantityReserved < beforeExpire.quantityReserved, {
    before: beforeExpire.quantityReserved,
    after: afterFirst.quantityReserved,
  });
  check("segunda execução NÃO alterou o estoque", afterSecond.quantityReserved === afterFirst.quantityReserved, {
    first: afterFirst.quantityReserved,
    second: afterSecond.quantityReserved,
  });
  check("reserva marcada como EXPIRED", expiredStatus.status === "EXPIRED", expiredStatus.status);

  // -------------------------------------------------------------------------
  console.log("\n[6] Limpeza");
  const testOrders = await prisma.order.findMany({ where: { idempotencyKey: { startsWith: RUN } }, select: { id: true } });
  const ids = testOrders.map((o) => o.id);
  await prisma.paymentEvent.deleteMany({ where: { externalEventId: { startsWith: RUN } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.inventory.update({
    where: { variantId: variant.id },
    data: { quantityOnHand: originalOnHand, quantityReserved: originalReserved },
  });
  // restaura contador de cupom se usado
  if (coupon) {
    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { decrement: 1 } },
    });
  }
  console.log("  ok    dados de teste removidos e estoque restaurado");

  console.log(`\nResultado: ${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
