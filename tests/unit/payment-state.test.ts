import { describe, expect, it } from "vitest";

import {
  assertPaymentTransition,
  canTransitionPaymentStatus,
  validatePaymentTransition,
} from "@/modules/payments/state";

describe("canTransitionPaymentStatus", () => {
  it("permite transições válidas", () => {
    expect(canTransitionPaymentStatus("PENDING", "AUTHORIZED")).toBe(true);
    expect(canTransitionPaymentStatus("PENDING", "PAID")).toBe(true);
    expect(canTransitionPaymentStatus("PENDING", "FAILED")).toBe(true);
    expect(canTransitionPaymentStatus("AUTHORIZED", "PAID")).toBe(true);
    expect(canTransitionPaymentStatus("PAID", "REFUNDED")).toBe(true);
    expect(canTransitionPaymentStatus("FAILED", "CANCELED")).toBe(true);
  });

  it("bloqueia transições inválidas", () => {
    expect(canTransitionPaymentStatus("PAID", "PENDING")).toBe(false);
    expect(canTransitionPaymentStatus("REFUNDED", "PAID")).toBe(false);
    expect(canTransitionPaymentStatus("CANCELED", "PAID")).toBe(false);
    expect(canTransitionPaymentStatus("FAILED", "PAID")).toBe(false);
    expect(canTransitionPaymentStatus("PAID", "PAID")).toBe(false);
  });
});

describe("validatePaymentTransition", () => {
  it("considera from === to como no-op válido", () => {
    expect(validatePaymentTransition("PAID", "PAID").valid).toBe(true);
  });

  it("retorna erro descritivo em transição inválida", () => {
    const result = validatePaymentTransition("REFUNDED", "PAID");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("REFUNDED -> PAID");
  });
});

describe("assertPaymentTransition", () => {
  it("lança em transição inválida", () => {
    expect(() => assertPaymentTransition("REFUNDED", "PAID")).toThrow();
  });

  it("não lança em transição válida ou no-op", () => {
    expect(() => assertPaymentTransition("PENDING", "PAID")).not.toThrow();
    expect(() => assertPaymentTransition("PAID", "PAID")).not.toThrow();
  });
});
