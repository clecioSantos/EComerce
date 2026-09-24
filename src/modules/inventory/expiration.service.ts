import "server-only";

import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-context";
import { validateOrderTransition } from "@/modules/orders/order";

import { releaseStock } from "./inventory.service";
import {
  findExpiredActiveReservations,
  markReservationExpired,
} from "./reservation.service";

export interface ExpirationResult {
  releasedReservations: number;
  expiredOrders: number;
}

/**
 * Expira reservas ACTIVE cujo `expiresAt` já passou, liberando o estoque.
 *
 * Idempotente: a transição ACTIVE -> EXPIRED usa update condicional, então uma
 * segunda execução não libera estoque novamente.
 *
 * Se, após liberar as reservas, o pedido continuar PENDING e sem reservas
 * ativas, ele é marcado como EXPIRED (transição validada pela máquina de
 * estados). Não há agendamento aqui; o serviço está pronto para ser chamado por
 * um cron/job externo.
 */
export async function expireOverdueReservations(
  now: Date = new Date(),
): Promise<ExpirationResult> {
  const candidates = await findExpiredActiveReservations(now);
  const touchedOrders = new Set<string>();
  let releasedReservations = 0;

  for (const reservation of candidates) {
    const released = await prisma.$transaction(async (tx) => {
      const claimed = await markReservationExpired(tx, reservation.id, now);
      if (!claimed) return false;

      await releaseStock(
        reservation.variantId,
        reservation.quantity,
        reservation.orderId,
        tx,
      );
      return true;
    });

    if (released) {
      releasedReservations += 1;
      touchedOrders.add(reservation.orderId);
    }
  }

  let expiredOrders = 0;
  for (const orderId of touchedOrders) {
    const stillActive = await prisma.stockReservation.count({
      where: { orderId, status: "ACTIVE" },
    });
    if (stillActive > 0) continue;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "PENDING") continue;

    if (validateOrderTransition(order.status, "EXPIRED").valid) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "EXPIRED" },
      });
      logEvent("ORDER_EXPIRED", {
        requestId: await getRequestId(),
        orderId,
      });
      expiredOrders += 1;
    }
  }

  return { releasedReservations, expiredOrders };
}
