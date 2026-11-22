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
      ? item.quantityOnHand - item.quantityReserved - item.quantityQuarantined <=
        item.reorderLevel
      : item.quantityOnHand - item.quantityReserved - item.quantityQuarantined <=
        threshold,
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
          AND ("allowBackorder" = true OR "quantityOnHand" - "quantityQuarantined" >= ${q})`;

    case "ADJUSTMENT":
      return db.$executeRaw`
        UPDATE "inventory"
        SET "quantityOnHand" = "quantityOnHand" + ${input.quantity}
        WHERE "variantId" = ${input.variantId}
          AND ("allowBackorder" = true OR "quantityOnHand" + ${input.quantity} >= "quantityReserved" + "quantityQuarantined")`;

    case "RESERVATION":
      return db.$executeRaw`
        UPDATE "inventory"
        SET "quantityReserved" = "quantityReserved" + ${q}
        WHERE "variantId" = ${input.variantId}
          AND ("allowBackorder" = true
               OR ("quantityOnHand" - "quantityReserved" - "quantityQuarantined") >= ${q})`;

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
          AND ("allowBackorder" = true OR "quantityOnHand" - "quantityQuarantined" >= ${q})`;

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
      throw new InventoryError("Estoque insuficiente ou conflito de concorrência.");
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

export async function adjustStock(variantId: string, quantity: number, reason?: string) {
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

/** Atualiza campos administrativos de estoque em uma operação atômica e auditável. */
export async function updateInventoryValues(input: {
  variantId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityOnConditional: number;
  quantityQuarantined: number;
  reorderLevel: number;
  allowBackorder: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.inventory.findUnique({ where: { variantId: input.variantId } });
    if (!previous) throw new InventoryError("Estoque não encontrado para a variante.");
    if (!input.allowBackorder &&
        input.quantityOnHand < input.quantityReserved + input.quantityQuarantined) {
      throw new InventoryError("Estoque físico insuficiente para as reservas e a conferência.");
    }

    // Compare-and-swap: um pedido simultâneo não deve ser sobrescrito pelo formulário.
    const result = await tx.inventory.updateMany({
      where: {
        id: previous.id,
        quantityOnHand: previous.quantityOnHand,
        quantityReserved: previous.quantityReserved,
        quantityOnConditional: previous.quantityOnConditional,
        quantityQuarantined: previous.quantityQuarantined,
        reorderLevel: previous.reorderLevel,
        allowBackorder: previous.allowBackorder,
      },
      data: {
        quantityOnHand: input.quantityOnHand,
        quantityReserved: input.quantityReserved,
        quantityOnConditional: input.quantityOnConditional,
        quantityQuarantined: input.quantityQuarantined,
        reorderLevel: input.reorderLevel,
        allowBackorder: input.allowBackorder,
      },
    });
    if (result.count !== 1) {
      throw new InventoryError("O estoque foi alterado por outra operação. Atualize a página e tente novamente.");
    }
    const before = {
      quantityOnHand: previous.quantityOnHand,
      quantityReserved: previous.quantityReserved,
      quantityOnConditional: previous.quantityOnConditional,
      quantityQuarantined: previous.quantityQuarantined,
      reorderLevel: previous.reorderLevel,
      allowBackorder: previous.allowBackorder,
    };
    const after = {
      quantityOnHand: input.quantityOnHand,
      quantityReserved: input.quantityReserved,
      quantityOnConditional: input.quantityOnConditional,
      quantityQuarantined: input.quantityQuarantined,
      reorderLevel: input.reorderLevel,
      allowBackorder: input.allowBackorder,
    };
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await tx.inventoryMovement.create({
        data: {
          inventoryId: previous.id,
          variantId: input.variantId,
          type: "ADJUSTMENT",
          quantity: input.quantityOnHand - previous.quantityOnHand,
          reason: "Edição manual dos valores de estoque (admin)",
          metadata: { before, after },
        },
      });
    }
  });
}
