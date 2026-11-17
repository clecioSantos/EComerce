/**
 * Compra Condicional — tipos e códigos de domínio.
 *
 * Este módulo é genérico (não conhece Mercado Pago nem o schema Prisma).
 * As regras puras vivem em `policy.ts`, `eligibility.ts` e `workflow.ts`.
 */

export interface ConditionalPolicyValues {
  enabled: boolean;
  maxItemsPerOrder: number;
  maxOrderAmount: number;
  maxOpenConditionalOrders: number;
  maxCustomerExposure: number;
  decisionDeadlineDays: number;
}

/** Override do cliente: `null`/`undefined` = herda da política da loja. */
export interface ConditionalOverrideValues {
  enabled?: boolean | null;
  maxItemsPerOrder?: number | null;
  maxOrderAmount?: number | null;
  maxOpenConditionalOrders?: number | null;
  maxCustomerExposure?: number | null;
}

export type ConditionalCustomerStatusValue =
  "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type ConditionalEligibilityCode =
  | "CONDITIONAL_PURCHASE_DISABLED"
  | "CUSTOMER_NOT_APPROVED"
  | "CUSTOMER_SUSPENDED"
  | "CUSTOMER_REJECTED"
  | "TERM_NOT_ACCEPTED"
  | "PRODUCT_NOT_ELIGIBLE"
  | "MAX_ITEMS_EXCEEDED"
  | "MAX_ORDER_AMOUNT_EXCEEDED"
  | "MAX_OPEN_ORDERS_EXCEEDED"
  | "CUSTOMER_EXPOSURE_LIMIT_EXCEEDED"
  | "INSUFFICIENT_STOCK"
  | "EMPTY_ORDER";

export interface ConditionalEligibilityItem {
  variantId: string;
  quantity: number;
  unitPrice: number;
  /** Produto/variante permite Compra Condicional. */
  eligible: boolean;
  /** Estoque disponível (onHand - reserved) no momento da avaliação. */
  availableStock: number;
}

export interface ConditionalEligibilityInput {
  policy: ConditionalPolicyValues;
  customerStatus: ConditionalCustomerStatusValue | null;
  termAccepted: boolean;
  items: ConditionalEligibilityItem[];
  /** Exposição atual do cliente (mercadorias em posse). */
  currentExposure: number;
  /** Quantidade de pedidos condicionais abertos. */
  openConditionalOrders: number;
}

export interface ConditionalEligibilityResult {
  allowed: boolean;
  reasons: ConditionalEligibilityCode[];
  totalItems: number;
  orderAmount: number;
  resultingExposure: number;
}

export const CONDITIONAL_ELIGIBILITY_MESSAGES: Record<
  ConditionalEligibilityCode,
  string
> = {
  CONDITIONAL_PURCHASE_DISABLED: "Compra Condicional indisponível nesta loja.",
  CUSTOMER_NOT_APPROVED: "Sua conta ainda não foi aprovada para Compra Condicional.",
  CUSTOMER_SUSPENDED: "Sua conta está suspensa para Compra Condicional.",
  CUSTOMER_REJECTED: "Sua conta não está habilitada para Compra Condicional.",
  TERM_NOT_ACCEPTED: "É necessário aceitar o termo de Compra Condicional.",
  PRODUCT_NOT_ELIGIBLE: "Um ou mais itens não aceitam Compra Condicional.",
  MAX_ITEMS_EXCEEDED: "Quantidade de peças acima do permitido.",
  MAX_ORDER_AMOUNT_EXCEEDED: "Valor do pedido acima do permitido.",
  MAX_OPEN_ORDERS_EXCEEDED:
    "Você já possui o número máximo de pedidos condicionais abertos.",
  CUSTOMER_EXPOSURE_LIMIT_EXCEEDED: "Seu limite de exposição foi excedido.",
  INSUFFICIENT_STOCK: "Estoque insuficiente para um ou mais itens.",
  EMPTY_ORDER: "O pedido não possui itens.",
};
