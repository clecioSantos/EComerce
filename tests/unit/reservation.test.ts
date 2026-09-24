import { describe, expect, it } from "vitest";

import {
  assertReservationTransition,
  canTransitionReservation,
  isReservationExpired,
  validateReservationTransition,
} from "@/modules/inventory/reservation";

describe("canTransitionReservation", () => {
  it("permite sair de ACTIVE", () => {
    expect(canTransitionReservation("ACTIVE", "CONSUMED")).toBe(true);
    expect(canTransitionReservation("ACTIVE", "RELEASED")).toBe(true);
    expect(canTransitionReservation("ACTIVE", "EXPIRED")).toBe(true);
  });

  it("trata estados finais como terminais", () => {
    expect(canTransitionReservation("CONSUMED", "RELEASED")).toBe(false);
    expect(canTransitionReservation("RELEASED", "CONSUMED")).toBe(false);
    expect(canTransitionReservation("EXPIRED", "CONSUMED")).toBe(false);
    expect(canTransitionReservation("CONSUMED", "CONSUMED")).toBe(false);
  });
});

describe("validateReservationTransition", () => {
  it("aceita transição válida", () => {
    expect(validateReservationTransition("ACTIVE", "CONSUMED").valid).toBe(true);
  });

  it("rejeita reuso de reserva consumida", () => {
    const result = validateReservationTransition("CONSUMED", "RELEASED");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("CONSUMED -> RELEASED");
  });
});

describe("assertReservationTransition", () => {
  it("lança em transição inválida", () => {
    expect(() => assertReservationTransition("RELEASED", "CONSUMED")).toThrow();
  });
});

describe("isReservationExpired", () => {
  it("expira apenas reservas ACTIVE com data vencida", () => {
    const past = new Date("2020-01-01T00:00:00Z");
    const future = new Date("2100-01-01T00:00:00Z");
    expect(isReservationExpired({ status: "ACTIVE", expiresAt: past })).toBe(true);
    expect(isReservationExpired({ status: "ACTIVE", expiresAt: future })).toBe(false);
    expect(isReservationExpired({ status: "CONSUMED", expiresAt: past })).toBe(false);
  });
});
