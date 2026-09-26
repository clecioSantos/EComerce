import { describe, expect, it } from "vitest";

import {
  buildShippingItems,
  sumShippingItemsSubtotal,
  type ShippingCartItemInput,
} from "@/modules/shipping/mappers";

function cartItem(
  patch: Partial<ShippingCartItemInput["variant"]> = {},
): ShippingCartItemInput {
  return {
    variantId: "v1",
    quantity: 2,
    variant: {
      sku: "SKU-1",
      price: 10,
      weight: 0.3,
      width: 11,
      height: 17,
      length: 11,
      ...patch,
    },
    product: { basePrice: 99 },
  };
}

describe("buildShippingItems", () => {
  it("usa o preço da variante quando presente", () => {
    const [item] = buildShippingItems([cartItem()]);
    expect(item.unitPrice).toBe(10);
    expect(item.sku).toBe("SKU-1");
    expect(item.quantity).toBe(2);
  });

  it("cai para o preço base do produto quando a variante não tem preço", () => {
    const [item] = buildShippingItems([cartItem({ price: null })]);
    expect(item.unitPrice).toBe(99);
  });

  it("preserva dimensões ausentes como null (sem valores fictícios)", () => {
    const [item] = buildShippingItems([
      cartItem({ width: null, height: null, length: null }),
    ]);
    expect(item.width).toBeNull();
    expect(item.height).toBeNull();
    expect(item.length).toBeNull();
  });
});

describe("sumShippingItemsSubtotal", () => {
  it("soma preço × quantidade com arredondamento monetário", () => {
    const items = buildShippingItems([
      cartItem({ price: 10.1 }),
      { ...cartItem({ price: 5.05 }), variantId: "v2", quantity: 3 },
    ]);
    expect(sumShippingItemsSubtotal(items)).toBe(35.35);
  });
});
