import { roundMoney } from "@/modules/pricing/engine";

import type {
  ConditionalEligibilityCode,
  ConditionalEligibilityInput,
  ConditionalEligibilityResult,
} from "./types";

/**
 * Motor de elegibilidade — puro e determinístico. O backend é a fonte de
 * verdade: o frontend nunca decide se um pedido condicional é permitido.
 *
 * Não faz I/O: recebe política efetiva, status/termo do cliente, itens (com
 * elegibilidade e estoque já consultados) e os agregados atuais (exposição e
 * pedidos abertos).
 */
export function evaluateConditionalEligibility(
  input: ConditionalEligibilityInput,
): ConditionalEligibilityResult {
  const { policy, customerStatus, termAccepted, items } = input;
  const reasons: ConditionalEligibilityCode[] = [];

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const orderAmount = roundMoney(
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
  const resultingExposure = roundMoney(input.currentExposure + orderAmount);

  if (!policy.enabled) reasons.push("CONDITIONAL_PURCHASE_DISABLED");

  if (customerStatus == null || customerStatus === "PENDING") {
    reasons.push("CUSTOMER_NOT_APPROVED");
  } else if (customerStatus === "REJECTED") {
    reasons.push("CUSTOMER_REJECTED");
  } else if (customerStatus === "SUSPENDED") {
    reasons.push("CUSTOMER_SUSPENDED");
  }

  if (!termAccepted) reasons.push("TERM_NOT_ACCEPTED");

  if (items.length === 0) reasons.push("EMPTY_ORDER");
  if (items.some((item) => !item.eligible)) reasons.push("PRODUCT_NOT_ELIGIBLE");
  if (items.some((item) => item.availableStock < item.quantity)) {
    reasons.push("INSUFFICIENT_STOCK");
  }

  if (totalItems > policy.maxItemsPerOrder) reasons.push("MAX_ITEMS_EXCEEDED");
  if (orderAmount > policy.maxOrderAmount) {
    reasons.push("MAX_ORDER_AMOUNT_EXCEEDED");
  }
  if (input.openConditionalOrders >= policy.maxOpenConditionalOrders) {
    reasons.push("MAX_OPEN_ORDERS_EXCEEDED");
  }
  if (resultingExposure > policy.maxCustomerExposure) {
    reasons.push("CUSTOMER_EXPOSURE_LIMIT_EXCEEDED");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    totalItems,
    orderAmount,
    resultingExposure,
  };
}
