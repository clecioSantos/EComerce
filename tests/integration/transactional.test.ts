import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { expireOverdueReservations } from "@/modules/inventory/expiration.service";
import { reserveStock } from "@/modules/inventory/inventory.service";
import {
  cancelOrder,
  confirmOrderPayment,
  createOrder,
  type CreateOrderInput,
} from "@/modules/orders/order.service";
import {
  handlePaymentWebhook,
  initiatePayment,
  refundOrder,
} from "@/modules/payments/payment.service";
import { deleteProduct } from "@/modules/products/product.service";

const PREFIX = `itest_${Date.now()}_`;
const asEmail = (label: string) => `${PREFIX}${label}@test.local`.toLowerCase();

let productTypeId = "";

type VariantRow = Awaited<ReturnType<typeof makeVariant>>["variant"];

async function makeVariant(onHand: number, reserved = 0) {
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
      inventory: { create: { quantityOnHand: onHand, quantityReserved: reserved } },
    },
    include: { inventory: true },
  });
  return { product, variant };
}

function orderInput(
  variant: VariantRow,
  params: {
    idempotencyKey: string;
    requestHash?: string;
    coupon?: { id: string; code: string } | null;
    userId?: string | null;
    quantity?: number;
  },
): CreateOrderInput {
  const quantity = params.quantity ?? 1;
  return {
    userId: params.userId ?? null,
    customer: { name: "Integration Test", email: asEmail("customer"), phone: null },
    shippingAddress: {
      recipient: "Integration Test",
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
    idempotencyKey: params.idempotencyKey,
    requestHash: params.requestHash ?? params.idempotencyKey,
  };
}

async function inventoryOf(variantId: string) {
  return prisma.inventory.findUniqueOrThrow({ where: { variantId } });
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
  await prisma.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.productVariantAttribute.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
  await prisma.productImage.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("estoque concorrente", () => {
  it("duas reservas disputando a última unidade: apenas uma vence", async () => {
    const { variant } = await makeVariant(1);
    const results = await Promise.allSettled([
      reserveStock(variant.id, 1),
      reserveStock(variant.id, 1),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1);
    const inv = await inventoryOf(variant.id);
    expect(inv.quantityReserved).toBe(1);
    expect(inv.quantityReserved).toBeLessThanOrEqual(inv.quantityOnHand);
  });

  it("constraints impedem estoque inválido", async () => {
    const { variant } = await makeVariant(1);
    await expect(
      prisma.inventory.update({
        where: { variantId: variant.id },
        data: { quantityReserved: -1 },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.inventory.update({
        where: { variantId: variant.id },
        data: { quantityReserved: 5 },
      }),
    ).rejects.toBeTruthy();
  });

  it("constraint impede reserva com quantidade <= 0 e reserva duplicada", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}c_res` }),
    );
    await expect(
      prisma.stockReservation.create({
        data: {
          orderId: order.id,
          variantId: variant.id,
          quantity: 0,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.stockReservation.create({
        data: {
          orderId: order.id,
          variantId: variant.id,
          quantity: 1,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toBeTruthy();
  });
});

describe("cupom concorrente", () => {
  it("maxUses=1 permite apenas um checkout", async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}MAX1`,
        type: "PERCENTAGE",
        value: 10,
        maxUses: 1,
        isActive: true,
      },
    });
    const { variant } = await makeVariant(10);
    const results = await Promise.allSettled([
      createOrder(
        orderInput(variant, {
          idempotencyKey: `${PREFIX}max1_a`,
          coupon: { id: coupon.id, code: coupon.code },
        }),
      ),
      createOrder(
        orderInput(variant, {
          idempotencyKey: `${PREFIX}max1_b`,
          coupon: { id: coupon.id, code: coupon.code },
        }),
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const row = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(row.usedCount).toBe(1);
    expect(await prisma.couponUsage.count({ where: { couponId: coupon.id } })).toBe(1);
  });

  it("maxUsesPerUser=1 permite apenas um checkout por usuário", async () => {
    const user = await prisma.user.create({
      data: { email: asEmail("peruser"), name: "Per User" },
    });
    const coupon = await prisma.coupon.create({
      data: {
        code: `${PREFIX}PER1`,
        type: "PERCENTAGE",
        value: 10,
        maxUsesPerUser: 1,
        isActive: true,
      },
    });
    const { variant } = await makeVariant(10);
    const results = await Promise.allSettled([
      createOrder(
        orderInput(variant, {
          idempotencyKey: `${PREFIX}per_a`,
          coupon: { id: coupon.id, code: coupon.code },
          userId: user.id,
        }),
      ),
      createOrder(
        orderInput(variant, {
          idempotencyKey: `${PREFIX}per_b`,
          coupon: { id: coupon.id, code: coupon.code },
          userId: user.id,
        }),
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect(await prisma.couponUsage.count({ where: { couponId: coupon.id } })).toBe(1);
  });
});

describe("idempotência de pagamento", () => {
  const customer = { name: "Integration Test", email: asEmail("pay") };

  it("mesma tentativa concorrente gera uma única cobrança", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}pay_order` }),
    );
    const key = `${PREFIX}attempt1`;
    await Promise.all([
      initiatePayment({
        orderId: order.id,
        amount: 100,
        currency: "BRL",
        method: "PIX",
        customer,
        idempotencyKey: key,
      }),
      initiatePayment({
        orderId: order.id,
        amount: 100,
        currency: "BRL",
        method: "PIX",
        customer,
        idempotencyKey: key,
      }),
    ]);
    const payments = await prisma.payment.findMany({
      where: { orderId: order.id, idempotencyKey: key },
    });
    expect(payments.length).toBe(1);
  });

  it("tentativas legítimas com chaves diferentes continuam permitidas", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}pay_order2` }),
    );
    await initiatePayment({
      orderId: order.id,
      amount: 100,
      currency: "BRL",
      method: "PIX",
      customer,
      idempotencyKey: `${PREFIX}attemptA`,
    });
    await initiatePayment({
      orderId: order.id,
      amount: 100,
      currency: "BRL",
      method: "PIX",
      customer,
      idempotencyKey: `${PREFIX}attemptB`,
    });
    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    expect(payments.length).toBe(2);
  });
});

describe("webhook idempotente", () => {
  it("mesmo evento 10x (concorrente) produz um único efeito", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}wh_order` }),
    );
    const { payment } = await initiatePayment({
      orderId: order.id,
      amount: 100,
      currency: "BRL",
      method: "PIX",
      customer: { name: "Integration Test", email: asEmail("wh") },
      idempotencyKey: `${PREFIX}wh_pay`,
    });
    const externalEventId = `${PREFIX}evt`;
    const payload = {
      provider: "mock",
      event: "payment.updated",
      externalEventId,
      providerPaymentId: payment.providerPaymentId ?? undefined,
      orderId: order.id,
      status: "PAID" as const,
      raw: { test: true },
    };
    await Promise.all(
      Array.from({ length: 10 }, () => handlePaymentWebhook("mock", payload)),
    );
    expect(
      await prisma.paymentEvent.count({
        where: { provider: "mock", externalEventId },
      }),
    ).toBe(1);
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.status).toBe("PAID");
    expect(
      await prisma.stockReservation.count({
        where: { orderId: order.id, status: "CONSUMED" },
      }),
    ).toBe(1);
  });
});

describe("cancelamento", () => {
  it("pedido PENDING cancelado libera a reserva", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}cancel_pending` }),
    );
    const before = await inventoryOf(variant.id);
    await cancelOrder(order.id);
    const after = await inventoryOf(variant.id);
    expect(after.quantityReserved).toBe(before.quantityReserved - 1);
    const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(cancelled.status).toBe("CANCELED");
  });

  it("pedido PAID cancelado devolve estoque (RESTOCK)", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}cancel_paid` }),
    );
    await confirmOrderPayment(order.id);
    const before = await inventoryOf(variant.id);
    await cancelOrder(order.id);
    const after = await inventoryOf(variant.id);
    expect(after.quantityOnHand).toBe(before.quantityOnHand + 1);
  });
});

describe("refund", () => {
  it("PAID -> REFUND devolve estoque e atualiza estados", async () => {
    const { variant } = await makeVariant(5);
    const original = await inventoryOf(variant.id);
    const order = await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}refund_order` }),
    );
    await confirmOrderPayment(order.id);
    await initiatePayment({
      orderId: order.id,
      amount: 100,
      currency: "BRL",
      method: "PIX",
      customer: { name: "Integration Test", email: asEmail("refund") },
      idempotencyKey: `${PREFIX}refund_pay`,
    });

    const result = await refundOrder(order.id);
    expect(result?.alreadyRefunded).toBe(false);

    const refunded = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.paymentStatus).toBe("REFUNDED");

    const after = await inventoryOf(variant.id);
    expect(after.quantityOnHand).toBe(original.quantityOnHand);

    expect(
      await prisma.inventoryMovement.count({
        where: { variantId: variant.id, type: "RESTOCK" },
      }),
    ).toBeGreaterThanOrEqual(1);
  });

  it("refund é idempotente", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}refund2_order` }),
    );
    await confirmOrderPayment(order.id);
    await initiatePayment({
      orderId: order.id,
      amount: 100,
      currency: "BRL",
      method: "PIX",
      customer: { name: "Integration Test", email: asEmail("refund2") },
      idempotencyKey: `${PREFIX}refund2_pay`,
    });
    await refundOrder(order.id);
    const afterFirst = await inventoryOf(variant.id);
    await refundOrder(order.id);
    const afterSecond = await inventoryOf(variant.id);
    expect(afterSecond.quantityOnHand).toBe(afterFirst.quantityOnHand);
  });
});

describe("expiração", () => {
  it("expira a reserva e libera estoque uma única vez", async () => {
    const { variant } = await makeVariant(5);
    const order = await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}expire_order` }),
    );
    await prisma.stockReservation.updateMany({
      where: { orderId: order.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const before = await inventoryOf(variant.id);
    await expireOverdueReservations();
    const afterFirst = await inventoryOf(variant.id);
    await expireOverdueReservations();
    const afterSecond = await inventoryOf(variant.id);

    expect(afterFirst.quantityReserved).toBe(before.quantityReserved - 1);
    expect(afterSecond.quantityReserved).toBe(afterFirst.quantityReserved);
    const reservation = await prisma.stockReservation.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(reservation.status).toBe("EXPIRED");
  });
});

describe("catálogo e histórico", () => {
  it("impede variantes duplicadas (mesma assinatura)", async () => {
    const { product, variant } = await makeVariant(1);
    await expect(
      prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `${PREFIX}dup-sku`,
          signature: variant.signature,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("não permite excluir produto com histórico de pedido", async () => {
    const { product, variant } = await makeVariant(5);
    await createOrder(
      orderInput(variant, { idempotencyKey: `${PREFIX}history_order` }),
    );
    await expect(deleteProduct(product.id)).rejects.toBeTruthy();
  });
});
