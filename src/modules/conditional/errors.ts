import type { ConditionalEligibilityCode } from "./types";

/** Erro de inelegibilidade com códigos estáveis para o frontend/logs. */
export class ConditionalEligibilityError extends Error {
  readonly reasons: ConditionalEligibilityCode[];

  constructor(reasons: ConditionalEligibilityCode[]) {
    super(reasons.join(",") || "CONDITIONAL_PURCHASE_NOT_ALLOWED");
    this.name = "ConditionalEligibilityError";
    this.reasons = reasons;
  }
}

/** Estoque insuficiente durante a reserva atômica. */
export class ConditionalStockError extends Error {
  readonly variantId: string;

  constructor(variantId: string) {
    super("INSUFFICIENT_STOCK");
    this.name = "ConditionalStockError";
    this.variantId = variantId;
  }
}
