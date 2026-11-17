import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { approveConditionalCustomer } from "@/modules/conditional/customer.service";
import { createConditionalOrder } from "@/modules/conditional/order.service";
import {
  getStorePolicyRecord,
  upsertStorePolicy,
} from "@/modules/conditional/policy.service";
import { acceptActiveTerm, publishTerm } from "@/modules/conditional/term.service";

const PREFIX = `itest_cp_${Date.now()}_`;
let productTypeId = "";
let termId = "";

async function makeVariant(onHand: number) {
  const suffix = Math.random().toString(36).slice(2, 10);
  const product = await prisma.product.create({
    data: {
      name: `${PREFIX}Product ${suffix}`,
      slug: `${PREFIX}product-${suffix}`,
      productTypeId,
      basePrice: 100,
      status: "ACTIVE",
      metadata: { conditionalPurchase: true },
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

async function makeApprovedCustomer() {
  const suffix = Math.random().toString(36).slice(2, 10);
  const user = await prisma.user.create({
    data: { email: `${PREFIX}${suffix}@test.local`, name: "Cond Test" },
  });
  await approveConditionalCustomer(user.id, null);
  await acceptActiveTerm(user.id);
  return user;
}

function orderInput(
  variant: Awaited<ReturnType<typeof makeVariant>>["variant"],
  params: { userId: string; quantity?: number; idempotencyKey: string },
) {
  const quantity = params.quantity ?? 1;
  return {
    userId: params.userId,
    customer: { name: "Cond Test", email: `${PREFIX}@test.local`, phone: null },
    shippingAddress: {
      recipient: "Cond Test",
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
        productName: "Conditional Product",
        variantName: null,
        sku: variant.sku,
        unitPrice: 100,
        quantity,
        discount: 0,
        attributesSnapshot: [],
        imageUrl: null,
      },
    ],
    shipping: { provider: "fixed", method: "Entrega padrão" },
    totals: {
      subtotal: 100 * quantity,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 100 * quantity,
      currency: "BRL",
    },
    coupon: null,
    cartId: null,
    notes: null,
    idempotencyKey: params.idempotencyKey,
    requestHash: params.idempotencyKey,
  };
}

beforeAll(async () => {
  const productType = await prisma.productType.findFirst({ orderBy: { createdAt: "asc" } });
  if (!productType) throw new Error("Base sem ProductType; rode o seed.");
  productTypeId = productType.id;

  const term = await publishTerm(
    { title: "Termo de teste", content: "Conteúdo do termo de teste para integração." },
    null,
  );
  termId = term.id;
});

afterAll(async () => {
  const orders = await prisma.order.findMany({
    where: { idempotencyKey: { startsWith: PREFIX } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);
  await prisma.conditionalPurchase.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

  const users = await prisma.user.findMany({
    where: { email: { startsWith: PREFIX } },
    select: { id: true },
  });
  await prisma.conditionalCustomer.deleteMany({
    where: { userId: { in: users.map((u) => u.id) } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

  const products = await prisma.product.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);
  const variants = await prisma.productVariant.findMany({
    where: { productId: { in: productIds } },
    select: { id: true },
  });
  const variantIds = variants.map((v) => v.id);
  await prisma.conditionalStockHold.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.inventory.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.stockReservation.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });

  await prisma.conditionalTerm.deleteMany({ where: { id: termId } });
  await prisma.conditionalPurchasePolicy.deleteMany({ where: { id: "default" } });
  await prisma.$disconnect();
});

describe("createConditionalOrder", () => {
  it("cria pedido condicional, reserva estoque e gera exposição", async () => {
    const record = await getStorePolicyRecord();
    await upsertStorePolicy({
      ...record,
      enabled: true,
      maxItemsPerOrder: 5,
      maxOrderAmount: 5000,
      maxOpenConditionalOrders: 10,
      maxCustomerExposure: 5000,
    });

    const { variant } = await makeVariant(3);
    const user = await makeApprovedCustomer();

    const result = await createConditionalOrder(
      orderInput(variant, { userId: user.id, idempotencyKey: `${PREFIX}ok` }),
    );
    expect(result.orderId).toBeTruthy();
    expect(result.status).toBe("PENDING_APPROVAL");

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
    expect(inventory.quantityReserved).toBe(1);

    const purchase = await prisma.conditionalPurchase.findUniqueOrThrow({
      where: { id: result.conditionalPurchaseId },
    });
    expect(Number(purchase.exposureAmount)).toBe(100);
    expect(purchase.termVersion).toBeTruthy();
  });

  it("não permite overselling em pedidos simultâneos (estoque)", async () => {
    const { variant } = await makeVariant(1);
    const userA = await makeApprovedCustomer();
    const userB = await makeApprovedCustomer();

    const results = await Promise.allSettled([
      createConditionalOrder(orderInput(variant, { userId: userA.id, idempotencyKey: `${PREFIX}stock_a` })),
      createConditionalOrder(orderInput(variant, { userId: userB.id, idempotencyKey: `${PREFIX}stock_b` })),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
    expect(inventory.quantityReserved).toBe(1);
  });

  it("protege o limite de exposição sob concorrência", async () => {
    const record = await getStorePolicyRecord();
    await upsertStorePolicy({
      ...record,
      enabled: true,
      maxItemsPerOrder: 5,
      maxOrderAmount: 5000,
      maxOpenConditionalOrders: 10,
      maxCustomerExposure: 150,
    });

    const { variant } = await makeVariant(10);
    const user = await makeApprovedCustomer();

    // Cada pedido = R$ 100; exposição limite = 150 -> apenas um pode passar.
    const results = await Promise.allSettled([
      createConditionalOrder(orderInput(variant, { userId: user.id, idempotencyKey: `${PREFIX}exp_a` })),
      createConditionalOrder(orderInput(variant, { userId: user.id, idempotencyKey: `${PREFIX}exp_b` })),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
    expect(inventory.quantityReserved).toBe(1);
  });
});
