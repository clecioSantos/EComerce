import type { StockReservationStatus } from "@/generated/prisma/enums";

/**
 * Máquina de estados de StockReservation — pura e testável.
 * Uma reserva ativa pode ser consumida (pagamento), liberada (cancelamento)
 * ou expirada (timeout). Os estados CONSUMED/RELEASED/EXPIRED são terminais.
 */
const RESERVATION_TRANSITIONS: Record<
  StockReservationStatus,
  StockReservationStatus[]
> = {
  ACTIVE: ["CONSUMED", "RELEASED", "EXPIRED"],
  CONSUMED: [],
  RELEASED: [],
  EXPIRED: [],
};

export interface ReservationTransitionValidation {
  valid: boolean;
  from: StockReservationStatus;
  to: StockReservationStatus;
  error?: string;
}

export function validateReservationTransition(
  from: StockReservationStatus,
  to: StockReservationStatus,
): ReservationTransitionValidation {
  if (from === to) return { valid: true, from, to };

  const allowed = RESERVATION_TRANSITIONS[from] ?? [];
  if (allowed.includes(to)) return { valid: true, from, to };

  return {
    valid: false,
    from,
    to,
    error: `Transição de reserva inválida: ${from} -> ${to}`,
  };
}

export function canTransitionReservation(
  from: StockReservationStatus,
  to: StockReservationStatus,
): boolean {
  if (from === to) return false;
  return (RESERVATION_TRANSITIONS[from] ?? []).includes(to);
}

export function assertReservationTransition(
  from: StockReservationStatus,
  to: StockReservationStatus,
): void {
  const result = validateReservationTransition(from, to);
  if (!result.valid) throw new Error(result.error);
}

export function isReservationExpired(
  reservation: { status: StockReservationStatus; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return reservation.status === "ACTIVE" && reservation.expiresAt.getTime() <= now.getTime();
}
