import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { lockConditionalStore, closeIfResolved } from "./service";

// Invoked inside the payment transaction; never creates a second stock reservation.
export async function settleConditionalOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  caseId: string,
) {
  await lockConditionalStore(tx);
  const row = await tx.conditionalCase.findUniqueOrThrow({
    where: { id: caseId },
    include: { items: true, order: true },
  });
  if (row.order?.id !== orderId || row.status !== "DECIDED")
    throw new Error("Acerto de condicional incompatível; requer conciliação.");
  for (const item of row.items) {
    const q = (item.keepQuantity ?? 0) - item.soldQuantity;
    if (q <= 0) continue;
    const affected =
      await tx.$executeRaw`UPDATE inventory SET "quantityOnConditional"="quantityOnConditional"-${q} WHERE "variantId"=${item.variantId} AND "quantityOnConditional">=${q}`;
    if (affected !== 1) throw new Error("Custódia de estoque inconsistente.");
    await tx.conditionalItem.update({
      where: { id: item.id },
      data: { soldQuantity: { increment: q } },
    });
    const inv = await tx.inventory.findUniqueOrThrow({
      where: { variantId: item.variantId },
    });
    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        variantId: item.variantId,
        type: "CONDITIONAL",
        quantity: q,
        referenceId: caseId,
        reason: `Condicional: venda de ${q} unidade(s) já expedidas`,
      },
    });
  }
  await tx.order.update({
    where: { id: orderId },
    data: { status: "PAID", paymentStatus: "PAID" },
  });
  await tx.conditionalEvent.upsert({
    where: { key: `paid:${orderId}` },
    create: {
      caseId,
      key: `paid:${orderId}`,
      type: "PAYMENT_CONFIRMED",
      message: "Pagamento do acerto confirmado.",
    },
    update: {},
  });
  await closeIfResolved(tx, caseId, { id: "payment", admin: true });
}
