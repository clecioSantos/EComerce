import { describe, expect, it } from "vitest";

import {
  assertOrderTransition,
  canTransitionOrderStatus,
  generateOrderNumber,
  validateOrderTransition,
} from "@/modules/orders/order";

describe("canTransitionOrderStatus", () => {
  it("permite transições válidas", () => {
    expect(canTransitionOrderStatus("PENDING", "PAID")).toBe(true);
    expect(canTransitionOrderStatus("PENDING", "CANCELED")).toBe(true);
    expect(canTransitionOrderStatus("PENDING", "EXPIRED")).toBe(true);
    expect(canTransitionOrderStatus("PAID", "REFUNDED")).toBe(true);
    expect(canTransitionOrderStatus("PROCESSING", "SHIPPED")).toBe(true);
    expect(canTransitionOrderStatus("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("bloqueia transições inválidas", () => {
    expect(canTransitionOrderStatus("DELIVERED", "PENDING")).toBe(false);
    expect(canTransitionOrderStatus("CANCELED", "PAID")).toBe(false);
    expect(canTransitionOrderStatus("EXPIRED", "PAID")).toBe(false);
    expect(canTransitionOrderStatus("REFUNDED", "PAID")).toBe(false);
    expect(canTransitionOrderStatus("PAID", "SHIPPED")).toBe(false);
    expect(canTransitionOrderStatus("PAID", "PAID")).toBe(false);
  });
});

describe("validateOrderTransition", () => {
  it("considera from === to como no-op válido", () => {
    const result = validateOrderTransition("PAID", "PAID");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("retorna erro descritivo em transição inválida", () => {
    const result = validateOrderTransition("CANCELED", "PAID");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("CANCELED -> PAID");
  });
});

describe("assertOrderTransition", () => {
  it("lança erro em transição inválida", () => {
    expect(() => assertOrderTransition("CANCELED", "PAID")).toThrow();
    expect(() => assertOrderTransition("EXPIRED", "PAID")).toThrow();
  });

  it("não lança em transição válida", () => {
    expect(() => assertOrderTransition("PENDING", "PAID")).not.toThrow();
    expect(() => assertOrderTransition("PENDING", "EXPIRED")).not.toThrow();
    expect(() => assertOrderTransition("PAID", "PAID")).not.toThrow();
  });
});

describe("generateOrderNumber", () => {
  it("gera um número no formato esperado", () => {
    const number = generateOrderNumber(new Date(2026, 8, 23, 12, 0, 0), "ABC123");
    expect(number).toBe("ORD-20260923-ABC123");
  });

  it("gera números distintos", () => {
    const first = generateOrderNumber();
    const second = generateOrderNumber();
    expect(first).not.toBe(second);
  });
});
