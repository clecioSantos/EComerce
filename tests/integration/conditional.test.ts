import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ store: `itest_conditional_${Date.now()}` }));
vi.mock("@/modules/conditional/rules", async (original) => ({
  ...(await original<typeof import("@/modules/conditional/rules")>()),
  STORE_ID: fixture.store,
}));
vi.mock("@/modules/shipping/quote.service", async () => {
  const m = await import("@/modules/shipping/mappers");
  return {
    ...m,
    quoteShippingForItems: async () => [
      { id: "pickup-store", provider: "pickup", label: "Retirada de teste", price: 0 },
    ],
  };
});
vi.mock("@/modules/payments/registry", async () => {
  const { MockPaymentProvider } =
    await import("@/modules/payments/providers/mock.provider");
  const provider = new MockPaymentProvider();
  return { getPaymentProvider: () => provider };
});
import { prisma } from "@/lib/db/prisma";
import { reserveStock } from "@/modules/inventory/inventory.service";
import { confirmOrderPayment } from "@/modules/orders/order.service";
import { refundOrder } from "@/modules/payments/payment.service";
import { payConditional } from "@/modules/conditional/payment";
import * as c from "@/modules/conditional/service";
const admin = { id: "integration-admin", admin: true };
const limits = {
  maxOpenAmount: 10000,
  maxOpenUnits: 30,
  maxCaseAmount: 10000,
  maxCaseUnits: 30,
  maxOpenCases: 10,
};
let productTypeId = "";
const userIds: string[] = [];
beforeAll(async () => {
  await prisma.store.create({
    data: { id: fixture.store, name: "Conditional Integration", slug: fixture.store },
  });
  productTypeId = (
    await prisma.productType.create({
      data: { name: fixture.store, slug: fixture.store },
    })
  ).id;
  await c.saveSettings(admin, {
    ...limits,
    enabled: true,
    trialDays: 3,
    returnDays: 5,
    paymentDays: 3,
    reserveHours: 24,
    requestHours: 48,
    terms: "Condições fictícias exclusivas para testes automatizados.",
    freightPolicy: "Retirada e retorno de teste sem custo.",
    customerPaysShipping: false,
    returnFee: 0,
    reason: "Configuração exclusiva da loja de teste",
  });
});
async function fixtureCase(quantity = 5, customLimits = {}) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@conditional.test`,
      name: "Test Customer",
      phone: "11999999999",
      role: "CUSTOMER",
    },
  });
  userIds.push(user.id);
  const address = await prisma.address.create({
    data: {
      userId: user.id,
      recipient: user.name!,
      line1: "Rua de teste 1",
      city: "São Paulo",
      state: "SP",
      postalCode: "01001000",
    },
  });
  await c.saveProfile(admin, {
    ...limits,
    ...customLimits,
    userId: user.id,
    eligibility: "ELIGIBLE",
    eligibleUntil: null,
    notes: "Somente integração",
    reason: "Autorização de teste",
  });
  const product = await prisma.product.create({
    data: {
      storeId: fixture.store,
      name: "Peça teste",
      slug: randomUUID(),
      productTypeId,
      basePrice: 100,
      status: "ACTIVE",
      conditionalEligible: true,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: randomUUID(),
      signature: randomUUID(),
      price: 100,
      weight: 0.5,
      width: 25,
      height: 5,
      length: 30,
      inventory: { create: { quantityOnHand: quantity } },
    },
  });
  const actor = { id: user.id, admin: false };
  const request = (qty = quantity, key = randomUUID()) =>
    c.requestConditional(actor, {
      key,
      items: [{ variantId: variant.id, quantity: qty }],
      addressId: address.id,
      shippingOptionId: "pickup-store",
      termsVersion: 1,
      accepted: true,
    });
  return { user, actor, address, variant, request };
}
async function deliver(f: Awaited<ReturnType<typeof fixtureCase>>) {
  const id = await f.request();
  await c.approveConditional(admin, id);
  await c.dispatchConditional(admin, id, "", "Saída de teste conferida");
  await c.receiveConditional(admin, id, "Recebimento de teste confirmado");
  return id;
}
describe("condicional transacional", () => {
  it("compra parcial, pagamento e retorno conferido conservam estoque e limites", async () => {
    const f = await fixtureCase();
    const id = await deliver(f);
    let row = await c.getCase(f.actor, id);
    await c.chooseConditional(f.actor, id, [{ itemId: row.items[0].id, quantity: 2 }]);
    row = await c.getCase(f.actor, id);
    expect(Number(row.order!.grandTotal)).toBe(200);
    expect(
      await prisma.stockReservation.count({ where: { orderId: row.order!.id } }),
    ).toBe(0);
    await payConditional(f.actor, id);
    await confirmOrderPayment(row.order!.id);
    let inv = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: f.variant.id },
    });
    expect([inv.quantityOnHand, inv.quantityOnConditional, inv.quantityReserved]).toEqual(
      [0, 3, 0],
    );
    await c.declareReturn(f.actor, id, "", "Devolução de três peças");
    expect((await c.customerSummary(f.user.id)).usage.units).toBe(3);
    const key = randomUUID();
    await c.receiveReturn(admin, id, row.items[0].id, 3, "Três peças recebidas", key);
    await c.receiveReturn(admin, id, row.items[0].id, 3, "Reenvio da mesma ação", key);
    inv = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: f.variant.id },
    });
    expect([
      inv.quantityOnHand,
      inv.quantityQuarantined,
      inv.quantityOnConditional,
    ]).toEqual([3, 3, 0]);
    await expect(reserveStock(f.variant.id, 1)).rejects.toThrow();
    row = await c.getCase(f.actor, id);
    await c.inspectReturn(
      admin,
      id,
      row.returns[0].id,
      "APPROVED",
      "Conferência de teste aprovada",
    );
    await c.inspectReturn(
      admin,
      id,
      row.returns[0].id,
      "APPROVED",
      "Reenvio da mesma conferência",
    );
    inv = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: f.variant.id },
    });
    expect([inv.quantityOnHand, inv.quantityQuarantined]).toEqual([3, 0]);
    expect((await c.getCase(f.actor, id)).status).toBe("CLOSED");
    expect((await c.customerSummary(f.user.id)).usage).toMatchObject({
      amount: 0,
      units: 0,
      cases: 0,
    });
  });
  it("duas aprovações simultâneas não consomem o mesmo limite individual", async () => {
    const f = await fixtureCase(4, { maxOpenUnits: 3, maxCaseUnits: 3 });
    const ids = await Promise.all([f.request(2), f.request(2)]);
    const results = await Promise.allSettled(
      ids.map((id) => c.approveConditional(admin, id)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await c.customerSummary(f.user.id)).usage.units).toBe(2);
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { variantId: f.variant.id } }))
        .quantityReserved,
    ).toBe(2);
  });
  it("suspensão impede saída mas preserva cancelamento e liberação", async () => {
    const f = await fixtureCase(2);
    const id = await f.request();
    await c.approveConditional(admin, id);
    await c.saveProfile(admin, {
      ...limits,
      userId: f.user.id,
      eligibility: "SUSPENDED",
      eligibleUntil: null,
      notes: "",
      reason: "Suspensão de teste",
    });
    await expect(
      c.dispatchConditional(admin, id, "", "Saída indevida de teste"),
    ).rejects.toThrow();
    await c.cancelConditional(f.actor, id, "Cancelamento solicitado pela cliente");
    await c.cancelConditional(f.actor, id, "Repetição de cancelamento");
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { variantId: f.variant.id } }))
        .quantityReserved,
    ).toBe(0);
  });
  it("devolver todas não cria pedido fictício e não libera limite antes da conferência", async () => {
    const f = await fixtureCase(2);
    const id = await deliver(f);
    let row = await c.getCase(f.actor, id);
    await c.chooseConditional(f.actor, id, [{ itemId: row.items[0].id, quantity: 0 }]);
    row = await c.getCase(f.actor, id);
    expect(row.order).toBeNull();
    await c.receiveReturn(
      admin,
      id,
      row.items[0].id,
      1,
      "Uma peça retornou",
      randomUUID(),
    );
    expect((await c.customerSummary(f.user.id)).usage.units).toBe(2);
    row = await c.getCase(f.actor, id);
    await c.inspectReturn(admin, id, row.returns[0].id, "ISSUE", "Peça com divergência");
    expect((await c.customerSummary(f.user.id)).usage.blocked).toBe(true);
    expect((await c.getCase(f.actor, id)).status).toBe("DECIDED");
    await c.inspectReturn(
      admin,
      id,
      row.returns[0].id,
      "APPROVED",
      "Divergência esclarecida e peça apta",
    );
    expect((await c.customerSummary(f.user.id)).usage.units).toBe(1);
  });
  it("reembolso não repõe peças já conferidas pela segunda vez", async () => {
    const f = await fixtureCase(2);
    const id = await deliver(f);
    let row = await c.getCase(f.actor, id);
    await c.chooseConditional(f.actor, id, [{ itemId: row.items[0].id, quantity: 1 }]);
    await payConditional(f.actor, id);
    row = await c.getCase(f.actor, id);
    expect(row.status).toBe("DECIDED");
    await expect(refundOrder(row.order!.id)).rejects.toThrow("confira");
    await c.receiveReturn(
      admin,
      id,
      row.items[0].id,
      1,
      "Compra retornou fisicamente",
      randomUUID(),
      true,
    );
    row = await c.getCase(f.actor, id);
    await c.inspectReturn(
      admin,
      id,
      row.returns[0].id,
      "APPROVED",
      "Compra devolvida em boas condições",
    );
    await refundOrder(row.order!.id);
    await c.receiveReturn(
      admin,
      id,
      row.items[0].id,
      1,
      "Retorno da peça não comprada",
      randomUUID(),
    );
    row = await c.getCase(f.actor, id);
    const pending = row.returns.find((receipt) => !receipt.purchased)!;
    await c.inspectReturn(
      admin,
      id,
      pending.id,
      "APPROVED",
      "Peça não comprada conferida",
    );
    expect((await c.getCase(f.actor, id)).status).toBe("CLOSED");
    const inv = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: f.variant.id },
    });
    expect([inv.quantityOnHand, inv.quantityQuarantined]).toEqual([2, 0]);
  });
  it("nega acesso de outra cliente e reuso de chave com payload diferente", async () => {
    const f = await fixtureCase(2);
    const key = randomUUID();
    const id = await f.request(1, key);
    expect(await f.request(1, key)).toBe(id);
    await expect(f.request(2, key)).rejects.toThrow();
    await expect(c.getCase({ id: "another-user", admin: false }, id)).rejects.toThrow(
      "não encontrado",
    );
  });
  it("prazo expirado após saída não devolve mercadoria ao disponível", async () => {
    const f = await fixtureCase(1);
    const id = await deliver(f);
    await prisma.conditionalCase.update({
      where: { id },
      data: { choiceDueAt: new Date(0) },
    });
    await c.maintainConditionalCases();
    expect((await c.getCase(f.actor, id)).status).toBe("RECEIVED");
    expect((await c.customerSummary(f.user.id)).usage.blocked).toBe(true);
    const inv = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: f.variant.id },
    });
    expect([inv.quantityOnHand, inv.quantityOnConditional]).toEqual([0, 1]);
  });
});
afterAll(async () => {
  // Delete only fixtures belonging to this run's unique test store.
  const cases = await prisma.conditionalCase.findMany({
    where: { storeId: fixture.store },
    select: { id: true },
  });
  const ids = cases.map((c) => c.id);
  const orders = await prisma.order.findMany({
    where: { storeId: fixture.store },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  const payments = await prisma.payment.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  await prisma.paymentTransaction.deleteMany({
    where: { paymentId: { in: payments.map((p) => p.id) } },
  });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.conditionalReturn.deleteMany({ where: { caseId: { in: ids } } });
  await prisma.conditionalShipment.deleteMany({ where: { caseId: { in: ids } } });
  await prisma.conditionalEvent.deleteMany({ where: { caseId: { in: ids } } });
  await prisma.conditionalItem.deleteMany({ where: { caseId: { in: ids } } });
  await prisma.conditionalCase.deleteMany({ where: { storeId: fixture.store } });
  await prisma.conditionalProfileEvent.deleteMany({ where: { storeId: fixture.store } });
  await prisma.conditionalCustomerProfile.deleteMany({
    where: { storeId: fixture.store },
  });
  await prisma.conditionalSettings.deleteMany({ where: { storeId: fixture.store } });
  const variants = await prisma.productVariant.findMany({
    where: { product: { storeId: fixture.store } },
    select: { id: true },
  });
  const vids = variants.map((v) => v.id);
  await prisma.inventoryMovement.deleteMany({ where: { variantId: { in: vids } } });
  await prisma.inventory.deleteMany({ where: { variantId: { in: vids } } });
  await prisma.productVariant.deleteMany({ where: { id: { in: vids } } });
  await prisma.product.deleteMany({ where: { storeId: fixture.store } });
  if (productTypeId) await prisma.productType.delete({ where: { id: productTypeId } });
  await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.store.delete({ where: { id: fixture.store } });
  await prisma.$disconnect();
});
