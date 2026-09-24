import { describe, expect, it } from "vitest";

import {
  cartItemCount,
  cartSubtotal,
  clampQuantity,
  mergeCartLines,
  removeCartLine,
  setLineQuantity,
  type CartLine,
} from "@/modules/cart/cart";

describe("clampQuantity", () => {
  it("limita entre 1 e o máximo", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-5)).toBe(1);
    expect(clampQuantity(500)).toBe(99);
    expect(clampQuantity(500, 10)).toBe(10);
    expect(clampQuantity(3.9)).toBe(3);
  });
});

describe("mergeCartLines", () => {
  it("adiciona uma nova linha", () => {
    const result = mergeCartLines([], { variantId: "v1", quantity: 2 });
    expect(result).toEqual([{ variantId: "v1", quantity: 2 }]);
  });

  it("soma a quantidade de uma variante existente", () => {
    const result = mergeCartLines(
      [{ variantId: "v1", quantity: 2 }],
      { variantId: "v1", quantity: 3 },
    );
    expect(result[0].quantity).toBe(5);
  });
});

describe("setLineQuantity", () => {
  it("atualiza a quantidade", () => {
    const result = setLineQuantity(
      [{ variantId: "v1", quantity: 2 }],
      "v1",
      5,
    );
    expect(result[0].quantity).toBe(5);
  });

  it("remove a linha quando a quantidade é zero", () => {
    const result = setLineQuantity(
      [{ variantId: "v1", quantity: 2 }],
      "v1",
      0,
    );
    expect(result).toHaveLength(0);
  });
});

describe("removeCartLine", () => {
  it("remove a variante informada", () => {
    const lines: CartLine[] = [
      { variantId: "v1", quantity: 1 },
      { variantId: "v2", quantity: 1 },
    ];
    expect(removeCartLine(lines, "v1")).toEqual([{ variantId: "v2", quantity: 1 }]);
  });
});

describe("cartItemCount e cartSubtotal", () => {
  it("conta itens e calcula subtotal", () => {
    const lines = [
      { variantId: "v1", quantity: 2, unitPrice: 10 },
      { variantId: "v2", quantity: 1, unitPrice: 5.5 },
    ];
    expect(cartItemCount(lines)).toBe(3);
    expect(cartSubtotal(lines)).toBe(25.5);
  });
});
