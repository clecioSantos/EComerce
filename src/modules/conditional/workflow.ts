/**
 * Máquina de estados da Compra Condicional — pura e testável.
 *
 * Não substitui o `OrderStatus`: o `Order` mantém seus estados de venda, e a
 * `ConditionalPurchase` controla a jornada da experimentação/decisão.
 */

export type ConditionalPurchaseState =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "DECISION_PENDING"
  | "PROCESSING_DECISION"
  | "COMPLETED"
  | "RETURNING"
  | "INSPECTING"
  | "ISSUE_FOUND"
  | "CANCELLED"
  | "EXPIRED";

const PURCHASE_TRANSITIONS: Record<ConditionalPurchaseState, ConditionalPurchaseState[]> =
  {
    PENDING_APPROVAL: ["APPROVED", "CANCELLED", "EXPIRED"],
    APPROVED: ["PREPARING", "CANCELLED"],
    PREPARING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: ["DECISION_PENDING"],
    DECISION_PENDING: ["PROCESSING_DECISION", "EXPIRED"],
    PROCESSING_DECISION: ["COMPLETED", "RETURNING"],
    RETURNING: ["INSPECTING"],
    INSPECTING: ["COMPLETED", "ISSUE_FOUND"],
    ISSUE_FOUND: ["COMPLETED", "INSPECTING"],
    COMPLETED: [],
    CANCELLED: [],
    EXPIRED: [],
  };

export function canTransitionConditionalPurchase(
  from: ConditionalPurchaseState,
  to: ConditionalPurchaseState,
): boolean {
  if (from === to) return false;
  return (PURCHASE_TRANSITIONS[from] ?? []).includes(to);
}

export function validateConditionalPurchaseTransition(
  from: ConditionalPurchaseState,
  to: ConditionalPurchaseState,
): { valid: boolean; error?: string } {
  if (from === to) return { valid: true };
  if (canTransitionConditionalPurchase(from, to)) return { valid: true };
  return {
    valid: false,
    error: `Transição de compra condicional inválida: ${from} -> ${to}`,
  };
}

export function assertConditionalPurchaseTransition(
  from: ConditionalPurchaseState,
  to: ConditionalPurchaseState,
): void {
  const result = validateConditionalPurchaseTransition(from, to);
  if (!result.valid) throw new Error(result.error);
}

export type ConditionalItemState =
  "PENDING_DECISION" | "KEEP" | "RETURN" | "RETURNING" | "RETURNED" | "INSPECTED";

const ITEM_TRANSITIONS: Record<ConditionalItemState, ConditionalItemState[]> = {
  PENDING_DECISION: ["KEEP", "RETURN"],
  KEEP: [],
  RETURN: ["RETURNING"],
  RETURNING: ["RETURNED"],
  RETURNED: ["INSPECTED"],
  INSPECTED: [],
};

export function canTransitionConditionalItem(
  from: ConditionalItemState,
  to: ConditionalItemState,
): boolean {
  if (from === to) return false;
  return (ITEM_TRANSITIONS[from] ?? []).includes(to);
}

/** Prazo de decisão a partir da entrega + dias da política. */
export function computeDecisionDeadline(deliveredAt: Date, deadlineDays: number): Date {
  return new Date(deliveredAt.getTime() + deadlineDays * 24 * 60 * 60 * 1000);
}

export function isDecisionExpired(
  deadline: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return deadline != null && deadline.getTime() < now.getTime();
}
