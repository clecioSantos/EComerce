import { describe, expect, it } from "vitest";

import { evaluateConditionalEligibility } from "@/modules/conditional/eligibility";
import { resolveEffectivePolicy } from "@/modules/conditional/policy";
import type {
  ConditionalEligibilityInput,
  ConditionalPolicyValues,
} from "@/modules/conditional/types";
import {
  canTransitionConditionalItem,
  canTransitionConditionalPurchase,
  computeDecisionDeadline,
  isDecisionExpired,
} from "@/modules/conditional/workflow";

const policy: ConditionalPolicyValues = {
  enabled: true,
  maxItemsPerOrder: 5,
  maxOrderAmount: 1500,
  maxOpenConditionalOrders: 1,
  maxCustomerExposure: 1500,
  decisionDeadlineDays: 7,
};

function baseInput(
  overrides: Partial<ConditionalEligibilityInput> = {},
): ConditionalEligibilityInput {
  return {
    policy,
    customerStatus: "APPROVED",
    termAccepted: true,
    items: [
      {
        variantId: "v1",
        quantity: 1,
        unitPrice: 100,
        eligible: true,
        availableStock: 10,
      },
    ],
    currentExposure: 0,
    openConditionalOrders: 0,
    ...overrides,
  };
}

describe("resolveEffectivePolicy", () => {
  it("usa a política da loja quando não há override", () => {
    expect(resolveEffectivePolicy(policy)).toEqual(policy);
  });

  it("aplica apenas os campos definidos no override", () => {
    const effective = resolveEffectivePolicy(policy, {
      maxItemsPerOrder: 8,
      maxCustomerExposure: 5000,
      maxOrderAmount: null,
    });
    expect(effective.maxItemsPerOrder).toBe(8);
    expect(effective.maxCustomerExposure).toBe(5000);
    expect(effective.maxOrderAmount).toBe(1500); // herdado
    expect(effective.decisionDeadlineDays).toBe(7);
  });

  it("override.enabled=false bloqueia mesmo com loja habilitada", () => {
    expect(resolveEffectivePolicy(policy, { enabled: false }).enabled).toBe(false);
  });
});

describe("evaluateConditionalEligibility", () => {
  it("permite quando todos os critérios são atendidos", () => {
    const result = evaluateConditionalEligibility(baseInput());
    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.orderAmount).toBe(100);
  });

  it("bloqueia loja desabilitada, cliente não aprovado e termo não aceito", () => {
    const result = evaluateConditionalEligibility(
      baseInput({
        policy: { ...policy, enabled: false },
        customerStatus: "PENDING",
        termAccepted: false,
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "CONDITIONAL_PURCHASE_DISABLED",
        "CUSTOMER_NOT_APPROVED",
        "TERM_NOT_ACCEPTED",
      ]),
    );
  });

  it("bloqueia cliente suspenso/rejeitado", () => {
    expect(
      evaluateConditionalEligibility(baseInput({ customerStatus: "SUSPENDED" })).reasons,
    ).toContain("CUSTOMER_SUSPENDED");
    expect(
      evaluateConditionalEligibility(baseInput({ customerStatus: "REJECTED" })).reasons,
    ).toContain("CUSTOMER_REJECTED");
  });

  it("valida peças, valor, produtos elegíveis e estoque", () => {
    const result = evaluateConditionalEligibility(
      baseInput({
        items: [
          {
            variantId: "a",
            quantity: 3,
            unitPrice: 100,
            eligible: true,
            availableStock: 2,
          },
          {
            variantId: "b",
            quantity: 4,
            unitPrice: 100,
            eligible: false,
            availableStock: 10,
          },
        ],
        policy: { ...policy, maxItemsPerOrder: 5, maxOrderAmount: 1000 },
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "INSUFFICIENT_STOCK",
        "PRODUCT_NOT_ELIGIBLE",
        "MAX_ITEMS_EXCEEDED",
      ]),
    );
    expect(result.totalItems).toBe(7);
    expect(result.orderAmount).toBe(700);
  });

  it("respeita o limite de exposição (borda)", () => {
    const allowed = evaluateConditionalEligibility(
      baseInput({
        currentExposure: 800,
        items: [
          {
            variantId: "a",
            quantity: 2,
            unitPrice: 100,
            eligible: true,
            availableStock: 10,
          },
        ],
      }),
    );
    // 800 + 200 = 1000 (limite) -> permitido
    expect(allowed.allowed).toBe(true);
    expect(allowed.resultingExposure).toBe(1000);

    const blocked = evaluateConditionalEligibility(
      baseInput({
        currentExposure: 800,
        items: [
          {
            variantId: "a",
            quantity: 1,
            unitPrice: 800,
            eligible: true,
            availableStock: 10,
          },
        ],
      }),
    );
    expect(blocked.reasons).toContain("CUSTOMER_EXPOSURE_LIMIT_EXCEEDED");
  });

  it("bloqueia quando o máximo de pedidos abertos é atingido", () => {
    const result = evaluateConditionalEligibility(
      baseInput({ openConditionalOrders: 1 }),
    );
    expect(result.reasons).toContain("MAX_OPEN_ORDERS_EXCEEDED");
  });
});

describe("workflow da compra condicional", () => {
  it("permite transições válidas e bloqueia inválidas", () => {
    expect(canTransitionConditionalPurchase("PENDING_APPROVAL", "APPROVED")).toBe(true);
    expect(canTransitionConditionalPurchase("DELIVERED", "DECISION_PENDING")).toBe(true);
    expect(canTransitionConditionalPurchase("DECISION_PENDING", "COMPLETED")).toBe(false);
    expect(canTransitionConditionalPurchase("COMPLETED", "APPROVED")).toBe(false);
  });

  it("transições de item", () => {
    expect(canTransitionConditionalItem("PENDING_DECISION", "KEEP")).toBe(true);
    expect(canTransitionConditionalItem("PENDING_DECISION", "RETURN")).toBe(true);
    expect(canTransitionConditionalItem("KEEP", "RETURN")).toBe(false);
    expect(canTransitionConditionalItem("RETURN", "RETURNING")).toBe(true);
  });

  it("calcula o prazo e a expiração da decisão", () => {
    const delivered = new Date("2026-10-10T00:00:00.000Z");
    const deadline = computeDecisionDeadline(delivered, 7);
    expect(deadline.toISOString()).toBe("2026-10-17T00:00:00.000Z");
    expect(isDecisionExpired(deadline, new Date("2026-10-16T00:00:00.000Z"))).toBe(false);
    expect(isDecisionExpired(deadline, new Date("2026-10-18T00:00:00.000Z"))).toBe(true);
  });
});
