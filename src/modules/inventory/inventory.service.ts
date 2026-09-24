import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

import { InventoryError, type MovementType } from "./inventory";

/** PrismaClient ou um client de transação (para operações atômicas compostas). */
export type DbClient = Prisma.TransactionClient;

export const inventoryMovementSchema = z.object({
  variantId: z.string().min(1),
  type: z.enum([
    "IN",
    "OUT",
    "ADJUSTMENT",
    "RESERVATION",
    "RELEASE",
    "CONSUME",
    "RESTOCK",
  ]),
  quantity: z.coerce.number().int(),
  reason: z.string().max(200).optional().nullable(),
  referenceId: z.string().max(120).optional().nullable(),
  userId: z.string().optional().nullable(),
});

export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;

export async function getInventoryForVariant(variantId: string) {
  return prisma.inventory.findUnique({ where: { variantId } });
}

export async function listInventoryMovements(variantId: string, take = 50) {
  return prisma.inventoryMovement.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listLowStock(threshold?: number) {
  const items = await prisma.inventory.findMany({
    include: { variant: { include: { product: true } } },
    orderBy: { quantityOnHand: "asc" },
  });
  return items.filter((item) =>
    threshold == null
      ? item.quantityOnHand - item.quantityReserved <= item.reorderLevel
      : item.quantityOnHand - item.quantityReserved <= threshold,
  );
}

/**
 * Atualização atômica e guardada do estoque.
 *
 * A verificação de disponibilidade acontece DENTRO do WHERE do UPDATE, de modo
 * que o PostgreSQL bloqueia a linha e o `affectedRows` decide o resultado. Isso
 * elimina a race condition de "ler -> validar -> escrever".
 *
 * Retorna o número de linhas afetadas (0 = estoque insuficiente/inexistente).
 */
async function runGuardedUpdate(
  db: DbClient,
  input: InventoryMovementInput,
): Promise<number> {
  const q = Math.abs(input.quantity);

  switch (input.type as MovementType) {
    case "IN":
    case "RESTOCK":
      return db.$executeRaw`
        UPDATE "inventory"
        SET "quantityOnHand" = "quantityOnHand" + ${q}
        WHERE "variantId" = ${input.variantId}`;

    case "OUT":
      return db.$executeRaw`
        UPDATE "inventory"
        SET "quantityOnHand" = "quantityOnHand" - ${q}
        WHERE "variantId" = ${input.variantId}
          AND ("allowBackorder" = true OR "quantityOnHand" >= ${q})`;

    case "ADJUSTMENT":
      return db.$executeRaw`
        UPDATE "inventory"
        SET "quantityOnHand" = "quantityOnHand" + ${input.quantity}
        WHERE "variantId" = ${input.variantId}
          AND ("allowBackorder" = true OR "quantityOnHand" + ${input.quantity} >= 0)`;

    case "RESERVATION":
      return db.$executeRaw`
        UPDATE "inventory"
        SET "quantityReserved" = "quantityReserved" + ${q}
        WHERE "variantId" = ${input.variantId}
          AND ("allowBackorder" = true
               OR ("quantityOnHand" - "quantityReserved") >= ${q})`;

    case "RELEASE":
      return db.$executeRaw`
        UPDATE "inventory"
        SET "quantityReserved" = "quantityReserved" - ${q}
        WHERE "variantId" = ${input.variantId}
          AND "quantityReserved" >= ${q}`;

    case "CONSUME":
      return db.$executeRaw`
        UPDATE "inventory"
        SET "quantityOnHand" = "quantityOnHand" - ${q},
            "quantityReserved" = "quantityReserved" - ${q}
        WHERE "variantId" = ${input.variantId}
          AND "quantityReserved" >= ${q}
          AND ("allowBackorder" = true OR "quantityOnHand" >= ${q})`;

    default: {
      const exhaustive: never = input.type as never;
      throw new InventoryError(`Tipo de movimento inválido: ${exhaustive}`);
    }
  }
}

/**
 * Aplica um movimento de estoque de forma atômica e registra o histórico.
 * Pode rodar dentro de uma transação existente (passe `tx`).
 */
export async function applyInventoryMovement(
  input: InventoryMovementInput,
  tx?: DbClient,
) {
  const run = async (db: DbClient) => {
    const affected = await runGuardedUpdate(db, input);

    if (affected === 0) {
      const exists = await db.inventory.findUnique({
        where: { variantId: input.variantId },
        select: { id: true },
      });
      if (!exists) {
        throw new InventoryError(
          `Inventário não encontrado para a variante ${input.variantId}.`,
        );
      }
      throw new InventoryError(
        "Estoque insuficiente ou conflito de concorrência.",
      );
    }

    const inventory = await db.inventory.findUniqueOrThrow({
      where: { variantId: input.variantId },
    });

    await db.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        variantId: input.variantId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason ?? null,
        referenceId: input.referenceId ?? null,
        userId: input.userId ?? null,
      },
    });

    return inventory;
  };

  if (tx) return run(tx);
  return prisma.$transaction((transaction) => run(transaction));
}

export async function adjustStock(
  variantId: string,
  quantity: number,
  reason?: string,
) {
  return applyInventoryMovement({ variantId, type: "ADJUSTMENT", quantity, reason });
}

export async function reserveStock(
  variantId: string,
  quantity: number,
  referenceId?: string,
  tx?: DbClient,
) {
  return applyInventoryMovement(
    {
      variantId,
      type: "RESERVATION",
      quantity,
      referenceId,
      reason: "Reserva de pedido",
    },
    tx,
  );
}

export async function releaseStock(
  variantId: string,
  quantity: number,
  referenceId?: string,
  tx?: DbClient,
) {
  return applyInventoryMovement(
    {
      variantId,
      type: "RELEASE",
      quantity,
      referenceId,
      reason: "Liberação de reserva",
    },
    tx,
  );
}

export async function consumeStock(
  variantId: string,
  quantity: number,
  referenceId?: string,
  tx?: DbClient,
) {
  return applyInventoryMovement(
    {
      variantId,
      type: "CONSUME",
      quantity,
      referenceId,
      reason: "Consumo de reserva (pagamento aprovado)",
    },
    tx,
  );
}

export async function restockStock(
  variantId: string,
  quantity: number,
  referenceId?: string,
  tx?: DbClient,
) {
  return applyInventoryMovement(
    {
      variantId,
      type: "RESTOCK",
      quantity,
      referenceId,
      reason: "Devolução ao estoque (estorno/reembolso)",
    },
    tx,
  );
}

export { InventoryError };
