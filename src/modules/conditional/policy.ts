import type { ConditionalOverrideValues, ConditionalPolicyValues } from "./types";

/**
 * Política efetiva = política da loja + override do cliente.
 *
 * O override só sobrescreve o que estiver explicitamente definido; campos
 * `null`/`undefined` herdam a loja. `enabled` do override pode bloquear
 * (`false`) ou reabilitar (`true`) o cliente.
 */
export function resolveEffectivePolicy(
  store: ConditionalPolicyValues,
  override?: ConditionalOverrideValues | null,
): ConditionalPolicyValues {
  if (!override) return { ...store };
  return {
    enabled: override.enabled ?? store.enabled,
    maxItemsPerOrder: override.maxItemsPerOrder ?? store.maxItemsPerOrder,
    maxOrderAmount: override.maxOrderAmount ?? store.maxOrderAmount,
    maxOpenConditionalOrders:
      override.maxOpenConditionalOrders ?? store.maxOpenConditionalOrders,
    maxCustomerExposure: override.maxCustomerExposure ?? store.maxCustomerExposure,
    decisionDeadlineDays: store.decisionDeadlineDays,
  };
}

export const DEFAULT_CONDITIONAL_POLICY: ConditionalPolicyValues = {
  enabled: false,
  maxItemsPerOrder: 5,
  maxOrderAmount: 1500,
  maxOpenConditionalOrders: 1,
  maxCustomerExposure: 1500,
  decisionDeadlineDays: 7,
};
