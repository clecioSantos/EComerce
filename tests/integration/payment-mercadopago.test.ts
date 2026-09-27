import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { createOrder, type CreateOrderInput } from "@/modules/orders/order.service";
import { applyPaymentStatus } from "@/modules/payments/payment.service";

const PREFIX = `itest_mp_${Date.now()}_`;
const STARTED_AT = new Date();
let productTypeId = "";

async function makeVariant(onHand: number) {
  const suffix = Math.random().toString(36).slice(2, 10);
  const product = await prisma.product.create({
    data: {
      name: `${PREFIX}Product ${suffix}`,
      slug: `${PREFIX}product-${suffix}`,
      productTypeId,
      basePrice: 100,
      status: "ACTIVE",
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `${PREFIX}SKU-${suffix}`,
      signature: `${PREFIX}sig-${suffix}`,
      price: 100,
      inventory: { create: { quantityOnHand: onHand } },
    },
  });
  return { product, variant };
}

function orderInput(
  variant: Awaited<ReturnType<typeof makeVariant>>["variant"],
  idempotencyKey: string,
): CreateOrderInput {
  return {
    userId: null,
    customer: { name: "MP Test", email: `${PREFIX}customer@test.local`, phone: null },
    shippingAddress: {
      recipient: "MP Test",
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
        productName: "Integration Product",
        variantName: null,
        sku: variant.sku,
        unitPrice: 100,
        quantity: 1,
        discount: 0,
        attributesSnapshot: [],
        imageUrl: null,
      },
    ],
    totals: {
      subtotal: 100,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 100,
      currency: "BRL",
    },
    shipping: { provider: "fixed", method: "Entrega padrão" },
    coupon: null,
    cartId: null,
    notes: null,
    idempotencyKey,
    requestHash: idempotencyKey,
  };
}

async function makePendingPayment(orderId: string, suffix: string, amount: number) {
  return prisma.payment.create({
    data: {
      orderId,
      provider: "mercadopago",
      providerPaymentId: `mp_${PREFIX}${suffix}`,
      idempotencyKey: `mpkey_${PREFIX}${suffix}`,
      method: "PIX",
      status: "PENDING",
      amount,
      currency: "BRL",
    },
  });
}

beforeAll(async () => {
  const productType = await prisma.productType.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!productType) throw new Error("Base sem ProductType; rode o seed.");
  productTypeId = productType.id;
});

afterAll(async () => {
  const orders = await prisma.order.findMany({
    where: { customerEmail: { startsWith: PREFIX } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);
  await prisma.paymentEvent.deleteMany({
    where: { provider: "mercadopago", receivedAt: { gte: STARTED_AT } },
  });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

  const products = await prisma.product.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const productIds = products.map((product) => product.id);
  const variants = await prisma.productVariant.findMany({
    where: { productId: { in: productIds } },
    select: { id: true },
  });
  const variantIds = variants.map((variant) => variant.id);
  await prisma.inventoryMovement.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.inventory.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.stockReservation.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.$disconnect();
});

describe("applyPaymentStatus (Mercado Pago)", () => {
  it("aprova o pagamento, consome estoque uma vez e deduplica o webhook", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(orderInput(variant, `${PREFIX}order1`));
    const payment = await makePendingPayment(order.id, "1", 100);

    const first = await applyPaymentStatus({
      providerId: "mercadopago",
      providerPaymentId: payment.providerPaymentId,
      status: "PAID",
      externalEventId: `evt_${PREFIX}1`,
    });
    expect(first).toMatchObject({ handled: true, duplicate: false, orderId: order.id });

    const paidOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paidOrder.status).toBe("PAID");
    expect(paidOrder.paymentStatus).toBe("PAID");

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: variant.id },
    });
    expect(inventory.quantityOnHand).toBe(4);
    expect(inventory.quantityReserved).toBe(0);

    // Reenvio do mesmo evento: duplicado, sem novo efeito.
    const second = await applyPaymentStatus({
      providerId: "mercadopago",
      providerPaymentId: payment.providerPaymentId,
      status: "PAID",
      externalEventId: `evt_${PREFIX}1`,
    });
    expect(second).toMatchObject({ duplicate: true });

    const inventoryAfter = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: variant.id },
    });
    expect(inventoryAfter.quantityOnHand).toBe(4);
  });

  it("não duplica efeitos sob concorrência (mesmo evento)", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(orderInput(variant, `${PREFIX}order2`));
    const payment = await makePendingPayment(order.id, "2", 100);

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        applyPaymentStatus({
          providerId: "mercadopago",
          providerPaymentId: payment.providerPaymentId,
          status: "PAID",
          externalEventId: `evt_${PREFIX}2`,
        }),
      ),
    );

    const processed = results.filter((result) => !result.duplicate);
    expect(processed).toHaveLength(1);

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: variant.id },
    });
    expect(inventory.quantityOnHand).toBe(4);
    expect(inventory.quantityReserved).toBe(0);
  });

  it("rejeita transição inválida (PAID -> PENDING) sem alterar o pedido", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(orderInput(variant, `${PREFIX}order3`));
    const payment = await makePendingPayment(order.id, "3", 100);

    await applyPaymentStatus({
      providerId: "mercadopago",
      providerPaymentId: payment.providerPaymentId,
      status: "PAID",
      externalEventId: `evt_${PREFIX}3a`,
    });

    const rejected = await applyPaymentStatus({
      providerId: "mercadopago",
      providerPaymentId: payment.providerPaymentId,
      status: "PENDING",
      externalEventId: `evt_${PREFIX}3b`,
    });
    expect(rejected).toMatchObject({ rejected: true });

    const current = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(current.status).toBe("PAID");
  });
});
