import type { PaymentStatus } from "@/generated/prisma/enums";

/**
 * Máquina de estados de pagamento — pura, centralizada e testável.
 *
 * O ciclo de vida do pagamento é independente do ciclo de vida do pedido:
 * um `FAILED` não cancela o pedido, e um `PAID` pode ser registrado mesmo que
 * o pedido já esteja encerrado (o pedido é quem decide se aceita a transição).
 */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["AUTHORIZED", "PAID", "FAILED", "CANCELED"],
  AUTHORIZED: ["PAID", "FAILED", "CANCELED"],
  PAID: ["REFUNDED"],
  FAILED: ["CANCELED"],
  CANCELED: [],
  REFUNDED: [],
};

export interface PaymentTransitionValidation {
  valid: boolean;
  from: PaymentStatus;
  to: PaymentStatus;
  error?: string;
}

/** `from === to` é válido (no-op) para permitir reenvio idempotente de webhooks. */
export function validatePaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): PaymentTransitionValidation {
  if (from === to) return { valid: true, from, to };

  const allowed = PAYMENT_TRANSITIONS[from] ?? [];
  if (allowed.includes(to)) return { valid: true, from, to };

  return {
    valid: false,
    from,
    to,
    error: `Transição de pagamento inválida: ${from} -> ${to}`,
  };
}

export function canTransitionPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  if (from === to) return false;
  return (PAYMENT_TRANSITIONS[from] ?? []).includes(to);
}

export function assertPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): void {
  const result = validatePaymentTransition(from, to);
  if (!result.valid) {
    throw new Error(result.error);
  }
}
