import type { OrderStatus } from "@/generated/prisma/enums";

/**
 * Máquina de estados de pedido — pura, centralizada e testável.
 *
 * Regras centrais:
 * - `PENDING -> PAID` / `PENDING -> CANCELED` / `PENDING -> EXPIRED`: permitido.
 * - `PAID -> REFUNDED`: permitido.
 * - `CANCELED -> PAID` e `EXPIRED -> PAID`: PROIBIDO (pedido encerrado).
 * - Um pagamento que falha NÃO cancela o pedido automaticamente; o pedido
 *   permanece `PENDING` para permitir nova tentativa.
 */
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELED", "EXPIRED"],
  PAID: ["PROCESSING", "REFUNDED", "CANCELED"],
  PROCESSING: ["SHIPPED", "REFUNDED", "CANCELED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELED: [],
  REFUNDED: [],
  EXPIRED: [],
};

export interface OrderTransitionValidation {
  valid: boolean;
  from: OrderStatus;
  to: OrderStatus;
  error?: string;
}

/**
 * Valida uma transição. Diferente de `canTransitionOrderStatus`, tratar
 * `from === to` como válido (no-op) é intencional: webhooks podem reenviar o
 * mesmo status e isso não deve ser considerado erro.
 */
export function validateOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): OrderTransitionValidation {
  if (from === to) return { valid: true, from, to };

  const allowed = ORDER_TRANSITIONS[from] ?? [];
  if (allowed.includes(to)) return { valid: true, from, to };

  return {
    valid: false,
    from,
    to,
    error: `Transição de pedido inválida: ${from} -> ${to}`,
  };
}

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (from === to) return false;
  return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  const result = validateOrderTransition(from, to);
  if (!result.valid) {
    throw new Error(result.error);
  }
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

/** Número legível e único por dia: ORD-20260923-4F7K2A. */
export function generateOrderNumber(
  date: Date = new Date(),
  random: string = Math.random().toString(36).slice(2, 8).toUpperCase(),
): string {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}`;
  return `ORD-${stamp}-${random}`;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  PROCESSING: "Em separação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
  EXPIRED: "Expirado",
};
