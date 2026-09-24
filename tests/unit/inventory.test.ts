import { describe, expect, it } from "vitest";

import {
  applyMovement,
  availableQuantity,
  canFulfill,
  InventoryError,
} from "@/modules/inventory/inventory";

describe("availableQuantity", () => {
  it("desconta o reservado do físico", () => {
    expect(availableQuantity({ quantityOnHand: 10, quantityReserved: 3 })).toBe(7);
  });
});

describe("canFulfill", () => {
  it("permite quando há disponível suficiente", () => {
    expect(
      canFulfill({ quantityOnHand: 10, quantityReserved: 3 }, 5),
    ).toBe(true);
  });

  it("permite quando backorder está habilitado", () => {
    expect(
      canFulfill(
        { quantityOnHand: 0, quantityReserved: 0, allowBackorder: true },
        5,
      ),
    ).toBe(true);
  });

  it("recusa quantidade inválida", () => {
    expect(canFulfill({ quantityOnHand: 10, quantityReserved: 0 }, 0)).toBe(
      false,
    );
  });
});

describe("applyMovement", () => {
  const base = { quantityOnHand: 10, quantityReserved: 2 };

  it("entrada aumenta o físico", () => {
    const result = applyMovement(base, { type: "IN", quantity: 5 });
    expect(result.quantityOnHand).toBe(15);
    expect(result.quantityReserved).toBe(2);
  });

  it("saída reduz o físico", () => {
    const result = applyMovement(base, { type: "OUT", quantity: 4 });
    expect(result.quantityOnHand).toBe(6);
  });

  it("ajuste aceita delta negativo", () => {
    const result = applyMovement(base, { type: "ADJUSTMENT", quantity: -3 });
    expect(result.quantityOnHand).toBe(7);
  });

  it("reserva aumenta o reservado", () => {
    const result = applyMovement(base, { type: "RESERVATION", quantity: 5 });
    expect(result.quantityReserved).toBe(7);
  });

  it("liberação reduz o reservado", () => {
    const result = applyMovement(base, { type: "RELEASE", quantity: 1 });
    expect(result.quantityReserved).toBe(1);
  });

  it("falha ao deixar o físico negativo sem backorder", () => {
    expect(() =>
      applyMovement(base, { type: "OUT", quantity: 50 }),
    ).toThrow(InventoryError);
  });

  it("falha ao reservar mais do que o físico", () => {
    expect(() =>
      applyMovement(base, { type: "RESERVATION", quantity: 20 }),
    ).toThrow(InventoryError);
  });

  it("falha ao liberar reserva inexistente", () => {
    expect(() =>
      applyMovement(base, { type: "RELEASE", quantity: 10 }),
    ).toThrow(InventoryError);
  });

  it("permite físico negativo com backorder", () => {
    const result = applyMovement(
      { quantityOnHand: 1, quantityReserved: 0, allowBackorder: true },
      { type: "OUT", quantity: 5 },
    );
    expect(result.quantityOnHand).toBe(-4);
  });

  it("CONSUME reduz reservado e físico simultaneamente", () => {
    const result = applyMovement(
      { quantityOnHand: 10, quantityReserved: 3 },
      { type: "CONSUME", quantity: 3 },
    );
    expect(result.quantityOnHand).toBe(7);
    expect(result.quantityReserved).toBe(0);
  });

  it("CONSUME falha quando não há reserva suficiente", () => {
    expect(() =>
      applyMovement(
        { quantityOnHand: 10, quantityReserved: 1 },
        { type: "CONSUME", quantity: 3 },
      ),
    ).toThrow(InventoryError);
  });

  it("RESTOCK devolve ao físico sem tocar no reservado", () => {
    const result = applyMovement(
      { quantityOnHand: 7, quantityReserved: 0 },
      { type: "RESTOCK", quantity: 3 },
    );
    expect(result.quantityOnHand).toBe(10);
    expect(result.quantityReserved).toBe(0);
  });
});
