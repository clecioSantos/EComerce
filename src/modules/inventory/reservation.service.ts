import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Client que pode ser o PrismaClient ou um client de transação. */
export type DbClient = Prisma.TransactionClient;

export const RESERVATION_TTL_MINUTES = 30;

export function reservationExpiry(
  ttlMinutes = RESERVATION_TTL_MINUTES,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() + ttlMinutes * 60_000);
}

export async function createReservation(
  db: DbClient,
  params: {
    orderId: string;
    variantId: string;
    quantity: number;
    ttlMinutes?: number;
  },
) {
  return db.stockReservation.create({
    data: {
      orderId: params.orderId,
      variantId: params.variantId,
      quantity: params.quantity,
      status: "ACTIVE",
      expiresAt: reservationExpiry(params.ttlMinutes),
    },
  });
}

/**
 * Transições usam `updateMany` condicional (apenas a partir de ACTIVE), o que
 * torna a operação atômica e idempotente: uma segunda chamada retorna `false`
 * sem alterar nada.
 */
export async function markReservationConsumed(
  db: DbClient,
  id: string,
): Promise<boolean> {
  const result = await db.stockReservation.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "CONSUMED" },
  });
  return result.count > 0;
}

export async function markReservationReleased(
  db: DbClient,
  id: string,
  at: Date = new Date(),
): Promise<boolean> {
  const result = await db.stockReservation.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "RELEASED", releasedAt: at },
  });
  return result.count > 0;
}

export async function markReservationExpired(
  db: DbClient,
  id: string,
  at: Date = new Date(),
): Promise<boolean> {
  const result = await db.stockReservation.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "EXPIRED", releasedAt: at },
  });
  return result.count > 0;
}

export async function listReservationsForOrder(db: DbClient, orderId: string) {
  return db.stockReservation.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
}

export async function listActiveReservationsForOrder(
  db: DbClient,
  orderId: string,
) {
  return db.stockReservation.findMany({
    where: { orderId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
}

export async function findExpiredActiveReservations(now: Date = new Date()) {
  return prisma.stockReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    orderBy: { expiresAt: "asc" },
  });
}
