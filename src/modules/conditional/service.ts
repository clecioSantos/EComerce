import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  buildShippingItems,
  quoteShippingForItems,
  sumShippingItemsSubtotal,
} from "@/modules/shipping/quote.service";
import { releaseStock } from "@/modules/inventory/inventory.service";
import { generateOrderNumber } from "@/modules/orders/order";
import {
  ACTIVE,
  STORE_ID,
  afterHours,
  assertCapacity,
  effectiveLimits,
  moneySum,
  overdue,
  profileSchema,
  requestSchema,
  selectionSchema,
  settingsSchema,
  unresolved,
} from "./rules";

type Tx = Prisma.TransactionClient;
export type Actor = { id: string; admin: boolean; customerId?: string };
export const caseInclude = {
  items: { orderBy: { id: "asc" as const } },
  order: true,
  returns: { orderBy: { createdAt: "desc" as const } },
  shipments: { orderBy: { createdAt: "desc" as const } },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ConditionalCaseInclude;
export type CaseRow = Prisma.ConditionalCaseGetPayload<{ include: typeof caseInclude }>;
const json = (x: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(x));
export async function lockConditionalStore(tx: Tx) {
  await tx.$queryRaw`SELECT id FROM stores WHERE id=${STORE_ID} FOR UPDATE`;
}
function admin(actor: Actor) {
  if (!actor.admin) throw new Error("Acesso restrito à administração.");
}
function event(
  tx: Tx,
  id: string,
  actor: Actor,
  type: string,
  message: string,
  key: string = randomUUID(),
  data?: unknown,
) {
  return tx.conditionalEvent.create({
    data: {
      caseId: id,
      actorId: actor.id,
      type,
      message,
      key,
      data: data === undefined ? undefined : json(data),
    },
  });
}
async function transaction<T>(fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(
    async (tx) => {
      await lockConditionalStore(tx);
      return fn(tx);
    },
    { timeout: 15000 },
  );
}
async function owned(tx: Tx, id: string, actor: Actor) {
  const row = await tx.conditionalCase.findFirst({
    where: { id, storeId: STORE_ID, ...(!actor.admin ? { userId: actor.id } : {}) },
    include: caseInclude,
  });
  if (!row) throw new Error("Condicional não encontrado.");
  return row;
}
function assertStatus(row: CaseRow, statuses: string[]) {
  if (!statuses.includes(row.status))
    throw new Error("Esta ação não está disponível no estado atual.");
}
async function settings(tx: Tx) {
  const row = await tx.conditionalSettings.findUnique({ where: { storeId: STORE_ID } });
  if (!row?.enabled)
    throw new Error("Novas solicitações de condicional estão desativadas.");
  return row;
}
async function eligible(tx: Tx, userId: string) {
  const row = await tx.conditionalCustomerProfile.findUnique({
    where: { storeId_userId: { storeId: STORE_ID, userId } },
  });
  if (
    !row ||
    row.eligibility !== "ELIGIBLE" ||
    row.currency !== "BRL" ||
    (row.eligibleUntil && row.eligibleUntil < new Date())
  )
    throw new Error("Cliente não está habilitada para condicional. Consulte a loja.");
  return row;
}
export async function getUsage(tx: Tx, userId: string) {
  const rows = await tx.conditionalCase.findMany({
    where: { storeId: STORE_ID, userId, status: { in: ACTIVE } },
    include: { items: true, order: true, returns: { select: { outcome: true } } },
  });
  return {
    amount: moneySum(
      rows.flatMap((row) =>
        row.items.map((i) => ({ unitPrice: i.unitPrice, quantity: unresolved(i) })),
      ),
    ),
    units: rows.reduce(
      (n, row) => n + row.items.reduce((q, i) => q + unresolved(i), 0),
      0,
    ),
    cases: rows.length,
    blocked: rows.some((row) => overdue(row)),
  };
}
export async function customerSummary(userId: string) {
  const [profile, policy, usage] = await Promise.all([
    prisma.conditionalCustomerProfile.findUnique({
      where: { storeId_userId: { storeId: STORE_ID, userId } },
    }),
    prisma.conditionalSettings.findUnique({ where: { storeId: STORE_ID } }),
    getUsage(prisma, userId),
  ]);
  const limits = profile && policy ? effectiveLimits(policy, profile) : null;
  return { profile, policy, usage, limits };
}
export async function saveSettings(actor: Actor, input: unknown) {
  admin(actor);
  const data = settingsSchema.parse(input);
  return transaction(async (tx) => {
    const before = await tx.conditionalSettings.findUnique({
      where: { storeId: STORE_ID },
    });
    const { reason, ...values } = data;
    const after = await tx.conditionalSettings.upsert({
      where: { storeId: STORE_ID },
      create: { ...values, storeId: STORE_ID },
      update: { ...values, termsVersion: { increment: 1 } },
    });
    await tx.conditionalProfileEvent.create({
      data: {
        storeId: STORE_ID,
        actorId: actor.id,
        reason,
        before: before ? json(before) : undefined,
        after: json(after),
      },
    });
  });
}
export async function saveProfile(actor: Actor, input: unknown) {
  admin(actor);
  const data = profileSchema.parse(input);
  return transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: data.userId } });
    if (!user || user.role !== "CUSTOMER") throw new Error("Cliente não encontrada.");
    const before = await tx.conditionalCustomerProfile.findUnique({
      where: { storeId_userId: { storeId: STORE_ID, userId: data.userId } },
    });
    const { reason, ...values } = data;
    const fields = {
      ...values,
      eligibleUntil: values.eligibleUntil ? new Date(values.eligibleUntil) : null,
      reviewedBy: actor.id,
      reviewedAt: new Date(),
    };
    const after = await tx.conditionalCustomerProfile.upsert({
      where: { storeId_userId: { storeId: STORE_ID, userId: data.userId } },
      create: { ...fields, storeId: STORE_ID },
      update: fields,
    });
    await tx.conditionalProfileEvent.create({
      data: {
        storeId: STORE_ID,
        userId: data.userId,
        actorId: actor.id,
        reason,
        before: before ? json(before) : undefined,
        after: json(after),
      },
    });
  });
}
export async function setProductEligibility(actor: Actor, id: string, value: boolean) {
  admin(actor);
  return transaction(async (tx) => {
    const before = await tx.product.findFirst({ where: { id, storeId: STORE_ID } });
    if (!before) throw new Error("Produto não encontrado.");
    await tx.product.update({ where: { id }, data: { conditionalEligible: value } });
    await tx.conditionalProfileEvent.create({
      data: {
        storeId: STORE_ID,
        actorId: actor.id,
        reason: "Elegibilidade do produto",
        before: json({ productId: id, eligible: before.conditionalEligible }),
        after: json({ productId: id, eligible: value }),
      },
    });
  });
}
export async function quoteConditional(
  actor: Actor,
  input: { items: { variantId: string; quantity: number }[]; addressId: string },
) {
  const userId = actor.admin && actor.customerId ? actor.customerId : actor.id;
  const policy = await settings(prisma);
  await eligible(prisma, userId);
  const address = await prisma.address.findFirst({
    where: { id: input.addressId, userId: userId },
  });
  if (!address) throw new Error("Cadastre e selecione seu endereço.");
  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: input.items.map((i) => i.variantId) },
      isActive: true,
      product: { storeId: STORE_ID, status: "ACTIVE", conditionalEligible: true },
    },
    include: { product: true },
  });
  if (
    variants.length !== input.items.length ||
    new Set(input.items.map((i) => i.variantId)).size !== input.items.length
  )
    throw new Error("Selecione variantes distintas e elegíveis.");
  const items = buildShippingItems(
    input.items.map((i) => {
      const v = variants.find((v) => v.id === i.variantId)!;
      return { ...i, variant: v, product: v.product };
    }),
  );
  const options = await quoteShippingForItems({
    items,
    subtotal: sumShippingItemsSubtotal(items),
    destinationPostalCode: address.postalCode,
  });
  return { options, policy };
}
export async function requestConditional(actor: Actor, input: unknown) {
  const userId = actor.admin && actor.customerId ? actor.customerId : actor.id;
  const data = requestSchema.parse(input);
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        ...data,
        key: undefined,
        items: [...data.items].sort((a, b) => a.variantId.localeCompare(b.variantId)),
      }),
    )
    .digest("hex");
  const existing = await prisma.conditionalCase.findUnique({
    where: { requestKey: data.key },
  });
  if (existing) {
    if (existing.userId !== userId || existing.requestHash !== hash)
      throw new Error("Chave de solicitação já utilizada.");
    return existing.id;
  }
  const { options, policy } = await quoteConditional(actor, data);
  const shipping = options.find((o) => o.id === data.shippingOptionId);
  if (!shipping) throw new Error("Selecione uma opção de entrega válida.");
  return transaction(async (tx) => {
    const duplicate = await tx.conditionalCase.findUnique({
      where: { requestKey: data.key },
    });
    if (duplicate) {
      if (duplicate.userId !== userId || duplicate.requestHash !== hash)
        throw new Error("Chave de solicitação já utilizada.");
      return duplicate.id;
    }
    const current = await settings(tx);
    if (
      current.termsVersion !== data.termsVersion ||
      policy.termsVersion !== data.termsVersion
    )
      throw new Error("As condições mudaram. Revise a solicitação.");
    const profile = await eligible(tx, userId);
    const address = await tx.address.findFirst({
      where: { id: data.addressId, userId: userId },
    });
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!address || !user?.name || !user.phone)
      throw new Error("Complete nome, telefone e endereço no cadastro.");
    const variants = await tx.productVariant.findMany({
      where: {
        id: { in: data.items.map((i) => i.variantId) },
        isActive: true,
        product: {
          storeId: STORE_ID,
          status: "ACTIVE",
          conditionalEligible: true,
          currency: "BRL",
        },
      },
      include: {
        product: { include: { images: { take: 1, orderBy: { position: "asc" } } } },
        inventory: true,
        attributes: { include: { attributeValue: true } },
      },
    });
    if (variants.length !== data.items.length)
      throw new Error("Há itens que não estão disponíveis para condicional.");
    const lines = data.items.map((i) => {
      const v = variants.find((v) => v.id === i.variantId)!;
      if (
        !v.inventory ||
        v.inventory.quantityOnHand -
          v.inventory.quantityReserved -
          v.inventory.quantityQuarantined <
          i.quantity
      )
        throw new Error(`Estoque insuficiente: ${v.product.name}.`);
      return {
        variantId: v.id,
        productId: v.productId,
        productName: v.product.name,
        variantName: v.attributes.map((a) => a.attributeValue.value).join(" / "),
        sku: v.sku,
        imageUrl: v.product.images[0]?.url,
        unitPrice: v.price ?? v.product.basePrice,
        quantity: i.quantity,
      };
    });
    const amount = moneySum(lines);
    assertCapacity(
      effectiveLimits(current, profile),
      await getUsage(tx, userId),
      amount,
      lines.reduce((n, i) => n + i.quantity, 0),
    );
    const row = await tx.conditionalCase.create({
      data: {
        number: `CON-${randomUUID().slice(0, 8).toUpperCase()}`,
        storeId: STORE_ID,
        userId: userId,
        requestKey: data.key,
        requestHash: hash,
        address: json(address),
        terms: current.terms,
        termsVersion: current.termsVersion,
        freightPolicy: current.freightPolicy,
        policy: json(current),
        acceptedAt: new Date(),
        requestDueAt: afterHours(current.requestHours),
        shippingFee: current.customerPaysShipping ? shipping.price : 0,
        returnFee: current.returnFee,
        shippingSnapshot: json(shipping),
        items: { create: lines },
      },
    });
    await event(
      tx,
      row.id,
      actor,
      "REQUESTED",
      "Solicitação recebida; estoque e limite ainda não reservados.",
    );
    return row.id;
  });
}
export async function approveConditional(actor: Actor, id: string) {
  admin(actor);
  return transaction(async (tx) => {
    const row = await owned(tx, id, actor);
    if (row.status === "APPROVED") return;
    assertStatus(row, ["REQUESTED"]);
    if (row.requestDueAt < new Date()) throw new Error("Solicitação vencida.");
    const policy = await settings(tx);
    const profile = await eligible(tx, row.userId);
    assertCapacity(
      effectiveLimits(policy, profile),
      await getUsage(tx, row.userId),
      moneySum(row.items),
      row.items.reduce((n, i) => n + i.quantity, 0),
    );
    for (const i of [...row.items].sort((a, b) =>
      a.variantId.localeCompare(b.variantId),
    )) {
      const v = await tx.productVariant.findFirst({
        where: {
          id: i.variantId,
          isActive: true,
          product: { storeId: STORE_ID, status: "ACTIVE", conditionalEligible: true },
        },
        include: { inventory: true },
      });
      if (
        !v?.inventory ||
        v.inventory.quantityOnHand -
          v.inventory.quantityReserved -
          v.inventory.quantityQuarantined <
          i.quantity
      )
        throw new Error(`Estoque insuficiente: ${i.productName}.`);
      await move(
        tx,
        i.variantId,
        Prisma.sql`UPDATE inventory SET "quantityReserved"="quantityReserved"+${i.quantity} WHERE "variantId"=${i.variantId} AND "quantityOnHand"-"quantityReserved"-"quantityQuarantined">=${i.quantity}`,
        "reserva física",
        i.quantity,
        row.id,
        actor.id,
      );
    }
    await tx.conditionalCase.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        reserveDueAt: afterHours(policy.reserveHours),
      },
    });
    await event(
      tx,
      id,
      actor,
      "APPROVED",
      "Solicitação aprovada. Peças e limites reservados.",
      undefined,
      { limits: effectiveLimits(policy, profile) },
    );
  });
}
export async function cancelConditional(
  actor: Actor,
  id: string,
  reason: string,
  reject = false,
) {
  return transaction(async (tx) => {
    const row = await owned(tx, id, actor);
    if (["CANCELED", "REJECTED"].includes(row.status)) return;
    assertStatus(row, ["REQUESTED", "APPROVED"]);
    if (reject) admin(actor);
    if (reason.trim().length < 5) throw new Error("Informe o motivo.");
    if (row.status === "APPROVED")
      for (const i of row.items) await releaseStock(i.variantId, i.quantity, row.id, tx);
    await tx.conditionalCase.update({
      where: { id },
      data: { status: reject ? "REJECTED" : "CANCELED", closedAt: new Date() },
    });
    await event(tx, id, actor, reject ? "REJECTED" : "CANCELED", reason);
  });
}
async function move(
  tx: Tx,
  variantId: string,
  sql: Prisma.Sql,
  type: string,
  quantity: number,
  referenceId: string,
  actorId: string,
) {
  const count = await tx.$executeRaw(sql);
  if (count !== 1) throw new Error("Saldo de estoque mudou. Revise as quantidades.");
  const inventory = await tx.inventory.findUniqueOrThrow({ where: { variantId } });
  await tx.inventoryMovement.create({
    data: {
      inventoryId: inventory.id,
      variantId,
      type: "CONDITIONAL",
      quantity,
      reason: `Condicional: ${type} (${quantity} unidade(s))`,
      metadata: { operation: type, units: quantity },
      referenceId,
      userId: actorId,
    },
  });
}
export async function dispatchConditional(
  actor: Actor,
  id: string,
  tracking: string,
  evidence: string,
) {
  admin(actor);
  return transaction(async (tx) => {
    const row = await owned(tx, id, actor);
    if (row.status === "DISPATCHED") return;
    assertStatus(row, ["APPROVED"]);
    await eligible(tx, row.userId);
    if (!row.reserveDueAt || row.reserveDueAt < new Date())
      throw new Error("Reserva vencida. Cancele e solicite nova aprovação.");
    if (evidence.trim().length < 5)
      throw new Error("Informe a evidência de saída/retirada.");
    for (const i of row.items) {
      await move(
        tx,
        i.variantId,
        Prisma.sql`UPDATE inventory SET "quantityOnHand"="quantityOnHand"-${i.quantity},"quantityReserved"="quantityReserved"-${i.quantity},"quantityOnConditional"="quantityOnConditional"+${i.quantity} WHERE "variantId"=${i.variantId} AND "quantityReserved">=${i.quantity} AND "quantityOnHand"-"quantityQuarantined">=${i.quantity}`,
        "saída",
        i.quantity,
        id,
        actor.id,
      );
    }
    await tx.conditionalShipment.create({
      data: { caseId: id, direction: "OUTBOUND", tracking, evidence },
    });
    await tx.conditionalCase.update({
      where: { id },
      data: { status: "DISPATCHED", dispatchedAt: new Date() },
    });
    await event(tx, id, actor, "DISPATCHED", "Peças expedidas ou retiradas na loja.");
  });
}
export async function receiveConditional(actor: Actor, id: string, evidence: string) {
  admin(actor);
  return transaction(async (tx) => {
    const row = await owned(tx, id, actor);
    if (row.status === "RECEIVED") return;
    assertStatus(row, ["DISPATCHED"]);
    if (evidence.trim().length < 5)
      throw new Error("Informe a confirmação do recebimento.");
    const policy = row.policy as Record<string, number>;
    await tx.conditionalShipment.create({
      data: { caseId: id, direction: "DELIVERED", tracking: "", evidence },
    });
    await tx.conditionalCase.update({
      where: { id },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
        choiceDueAt: afterHours(policy.trialDays * 24),
      },
    });
    await event(
      tx,
      id,
      actor,
      "RECEIVED",
      "Recebimento confirmado. Prazo de experimentação iniciado.",
    );
  });
}
export async function chooseConditional(actor: Actor, id: string, input: unknown) {
  const choices = selectionSchema.parse(input);
  return transaction(async (tx) => {
    const row = await owned(tx, id, actor);
    assertStatus(row, ["RECEIVED"]);
    if (row.issue) throw new Error("Há uma ocorrência em revisão pela loja.");
    if (
      choices.length !== row.items.length ||
      new Set(choices.map((i) => i.itemId)).size !== row.items.length
    )
      throw new Error("Informe a decisão para todas as peças.");
    const lines = row.items.map((i) => {
      const choice = choices.find((c) => c.itemId === i.id);
      if (!choice || choice.quantity > i.quantity)
        throw new Error("Quantidade de compra inválida.");
      return { ...i, quantity: choice.quantity };
    });
    const kept = lines.filter((i) => i.quantity > 0);
    const hasReturn = lines.some(
      (i) => i.quantity < row.items.find((o) => o.id === i.id)!.quantity,
    );
    const subtotal = moneySum(kept);
    const fees = Number(row.shippingFee) + (hasReturn ? Number(row.returnFee) : 0);
    const total = moneySum([
      { unitPrice: subtotal, quantity: 1 },
      { unitPrice: fees, quantity: 1 },
    ]);
    const policy = row.policy as Record<string, number>;
    const user = await tx.user.findUniqueOrThrow({ where: { id: row.userId } });
    if (total > 0)
      await tx.order.create({
        data: {
          storeId: STORE_ID,
          conditionalCaseId: id,
          type: "CONDITIONAL",
          number: generateOrderNumber(),
          userId: row.userId,
          customerName: user.name ?? "Cliente",
          customerEmail: user.email,
          customerPhone: user.phone,
          subtotal,
          grandTotal: total,
          shippingTotal: fees,
          currency: row.currency,
          shippingAddress: row.address as Prisma.InputJsonValue,
          shippingProvider: "conditional",
          shippingMethod: "Remessa de condicional já realizada",
          notes: "Acerto de condicional; não reservar nem expedir novamente.",
          items: {
            create: kept.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              productName: i.productName,
              variantName: i.variantName,
              sku: i.sku,
              unitPrice: i.unitPrice,
              quantity: i.quantity,
              total: moneySum([i]),
              imageUrl: i.imageUrl,
            })),
          },
        },
      });
    for (const i of lines)
      await tx.conditionalItem.update({
        where: { id: i.id },
        data: { keepQuantity: i.quantity },
      });
    await tx.conditionalCase.update({
      where: { id },
      data: {
        status: "DECIDED",
        decidedAt: new Date(),
        paymentDueAt: total > 0 ? afterHours(policy.paymentDays * 24) : null,
        returnDueAt: hasReturn ? afterHours(policy.returnDays * 24) : null,
      },
    });
    await event(
      tx,
      id,
      actor,
      "DECIDED",
      "Escolha confirmada; acerto e devoluções registrados.",
    );
    await closeIfResolved(tx, id, actor);
  });
}
export async function declareReturn(
  actor: Actor,
  id: string,
  tracking: string,
  evidence: string,
) {
  return transaction(async (tx) => {
    const row = await owned(tx, id, actor);
    assertStatus(row, ["DECIDED"]);
    if (evidence.trim().length < 5) throw new Error("Informe os dados da devolução.");
    await tx.conditionalShipment.create({
      data: { caseId: id, direction: "RETURN", tracking, evidence },
    });
    await event(
      tx,
      id,
      actor,
      "RETURN_DECLARED",
      "Devolução informada; aguardando chegada e conferência.",
    );
  });
}
export async function receiveReturn(
  actor: Actor,
  id: string,
  itemId: string,
  quantity: number,
  evidence: string,
  key: string,
  purchased = false,
) {
  admin(actor);
  if (!Number.isInteger(quantity) || quantity < 1 || evidence.trim().length < 5)
    throw new Error("Informe quantidade e evidência válidas.");
  return transaction(async (tx) => {
    const row = await owned(tx, id, actor);
    if (await tx.conditionalEvent.findUnique({ where: { key } })) return;
    assertStatus(row, purchased ? ["DECIDED", "CLOSED"] : ["DECIDED"]);
    const item = row.items.find((i) => i.id === itemId);
    if (purchased && row.order?.paymentStatus !== "PAID")
      throw new Error("A compra precisa estar paga.");
    if (
      !item ||
      quantity >
        (purchased
          ? item.soldQuantity - item.purchasedReceivedQuantity
          : item.quantity - (item.keepQuantity ?? 0) - item.receivedQuantity)
    )
      throw new Error("Quantidade devolvida supera o previsto.");
    await move(
      tx,
      item.variantId,
      purchased
        ? Prisma.sql`UPDATE inventory SET "quantityOnHand"="quantityOnHand"+${quantity},"quantityQuarantined"="quantityQuarantined"+${quantity} WHERE "variantId"=${item.variantId}`
        : Prisma.sql`UPDATE inventory SET "quantityOnConditional"="quantityOnConditional"-${quantity},"quantityOnHand"="quantityOnHand"+${quantity},"quantityQuarantined"="quantityQuarantined"+${quantity} WHERE "variantId"=${item.variantId} AND "quantityOnConditional">=${quantity}`,
      "retorno em conferência",
      quantity,
      id,
      actor.id,
    );
    await tx.conditionalItem.update({
      where: { id: itemId },
      data: purchased
        ? { purchasedReceivedQuantity: { increment: quantity } }
        : { receivedQuantity: { increment: quantity } },
    });
    await tx.conditionalReturn.create({
      data: { caseId: id, itemId, quantity, evidence, purchased },
    });
    await event(
      tx,
      id,
      actor,
      "RETURN_RECEIVED",
      "Recebimento registrado; itens em quarentena.",
      key,
    );
  });
}
export async function inspectReturn(
  actor: Actor,
  id: string,
  returnId: string,
  outcome: string,
  evidence: string,
) {
  admin(actor);
  if (!["APPROVED", "ISSUE", "WRITE_OFF"].includes(outcome) || evidence.trim().length < 5)
    throw new Error("Informe resultado e justificativa da conferência.");
  return transaction(async (tx) => {
    const row = await owned(tx, id, actor);
    assertStatus(row, ["DECIDED", "CLOSED"]);
    const receipt = row.returns.find((r) => r.id === returnId);
    if (!receipt) throw new Error("Devolução não encontrada.");
    if (receipt.outcome === outcome) return;
    if (!["PENDING", "ISSUE"].includes(receipt.outcome))
      throw new Error("Conferência já concluída.");
    const item = row.items.find((i) => i.id === receipt.itemId)!;
    const q = receipt.quantity;
    if (outcome !== "ISSUE") {
      const sql =
        outcome === "APPROVED"
          ? Prisma.sql`UPDATE inventory SET "quantityQuarantined"="quantityQuarantined"-${q} WHERE "variantId"=${item.variantId} AND "quantityQuarantined">=${q}`
          : Prisma.sql`UPDATE inventory SET "quantityQuarantined"="quantityQuarantined"-${q},"quantityOnHand"="quantityOnHand"-${q} WHERE "variantId"=${item.variantId} AND "quantityQuarantined">=${q} AND "quantityOnHand">=${q}`;
      await move(
        tx,
        item.variantId,
        sql,
        outcome === "APPROVED" ? "conferência aprovada" : "baixa autorizada sem cobrança",
        q,
        id,
        actor.id,
      );
      await tx.conditionalItem.update({
        where: { id: item.id },
        data: receipt.purchased
          ? outcome === "APPROVED"
            ? { purchasedApprovedQuantity: { increment: q } }
            : {}
          : outcome === "APPROVED"
            ? { approvedReturnQuantity: { increment: q } }
            : { writtenOffQuantity: { increment: q } },
      });
    }
    await tx.conditionalReturn.update({
      where: { id: returnId },
      data: { outcome, evidence, inspectedBy: actor.id, inspectedAt: new Date() },
    });
    await event(
      tx,
      id,
      actor,
      "RETURN_INSPECTED",
      `Conferência: ${outcome}. ${evidence}`,
    );
    await closeIfResolved(tx, id, actor);
  });
}
export async function closeIfResolved(tx: Tx, id: string, actor: Actor) {
  const row = await tx.conditionalCase.findUniqueOrThrow({
    where: { id },
    include: caseInclude,
  });
  if (
    row.status !== "DECIDED" ||
    row.issue ||
    row.items.some((i) => unresolved(i) !== 0) ||
    (row.order && !["PAID", "REFUNDED"].includes(row.order.paymentStatus))
  )
    return;
  await tx.conditionalCase.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await event(
    tx,
    id,
    actor,
    "CLOSED",
    "Condicional encerrado: peças e acerto resolvidos.",
  );
}
export async function reviewCase(
  actor: Actor,
  id: string,
  input: {
    issue?: string | null;
    reason: string;
    choiceDueAt?: Date;
    returnDueAt?: Date;
    paymentDueAt?: Date;
  },
) {
  admin(actor);
  if (input.reason.trim().length < 5) throw new Error("Informe o motivo da revisão.");
  return transaction(async (tx) => {
    const row = await owned(tx, id, actor);
    assertStatus(row, ACTIVE);
    const before = {
      issue: row.issue,
      choiceDueAt: row.choiceDueAt,
      returnDueAt: row.returnDueAt,
      paymentDueAt: row.paymentDueAt,
    };
    for (const field of ["choiceDueAt", "returnDueAt", "paymentDueAt"] as const) {
      if (
        input[field] &&
        (!Number.isFinite(input[field]!.getTime()) || input[field]! < new Date())
      )
        throw new Error("Informe uma data futura.");
    }
    const { reason, ...data } = input;
    await tx.conditionalCase.update({ where: { id }, data });
    await event(tx, id, actor, "REVIEW", reason, undefined, { before, after: data });
    await closeIfResolved(tx, id, actor);
  });
}
export async function listCases(actor: Actor, pageInput = 1, status?: string) {
  const page = Number.isFinite(pageInput)
    ? Math.max(1, Math.min(10000, Math.floor(pageInput)))
    : 1;
  const rows = await prisma.conditionalCase.findMany({
    where: {
      storeId: STORE_ID,
      ...(!actor.admin ? { userId: actor.id } : {}),
      ...(status &&
      ["REQUESTED", ...ACTIVE, "CLOSED", "CANCELED", "REJECTED"].includes(status)
        ? { status }
        : {}),
    },
    include: {
      items: true,
      order: true,
      returns: { select: { outcome: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 51,
    skip: (page - 1) * 50,
  });
  return { rows: rows.slice(0, 50), hasMore: rows.length > 50, page };
}
export async function getCase(actor: Actor, id: string) {
  return owned(prisma, id, actor);
}
export async function maintainConditionalCases() {
  let expired = 0,
    alerts = 0;
  let cursor: string | undefined;
  const system: Actor = { id: "system", admin: true };
  while (true) {
    const candidates = await prisma.conditionalCase.findMany({
      where: { storeId: STORE_ID, status: { in: ["REQUESTED", ...ACTIVE] } },
      include: caseInclude,
      take: 100,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of candidates) {
      if (
        (row.status === "REQUESTED" && row.requestDueAt < new Date()) ||
        (row.status === "APPROVED" && row.reserveDueAt && row.reserveDueAt < new Date())
      ) {
        try {
          await cancelConditional(
            system,
            row.id,
            "Prazo de solicitação ou reserva vencido.",
          );
          expired++;
        } catch {
          /* A concurrent dispatch/approval must be left intact. */
        }
      } else if (overdue(row)) {
        await transaction(async (tx) => {
          const fresh = await owned(tx, row.id, system);
          if (!overdue(fresh)) return;
          const key = `overdue:${row.id}:${new Date().toISOString().slice(0, 10)}`;
          if (!(await tx.conditionalEvent.findUnique({ where: { key } }))) {
            await event(
              tx,
              row.id,
              system,
              "OVERDUE",
              "Há prazo vencido ou ocorrência. Entre em contato com a loja.",
              key,
            );
            alerts++;
          }
        });
      }
    }
    if (candidates.length < 100) break;
    cursor = candidates[candidates.length - 1].id;
  }
  return { expired, alerts };
}
