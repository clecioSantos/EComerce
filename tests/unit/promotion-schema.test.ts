import { describe, expect, it } from "vitest";

import { createPromotionSchema } from "@/modules/promotions/schemas";

describe("createPromotionSchema", () => {
  it("aceita frete grátis com subtotal mínimo", () => {
    const result = createPromotionSchema.safeParse({
      name: "Frete grátis acima de R$ 199",
      type: "FREE_SHIPPING",
      value: 0,
      minSubtotal: 199,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita percentual acima de 100", () => {
    expect(
      createPromotionSchema.safeParse({
        name: "Desconto",
        type: "PERCENTAGE",
        value: 150,
      }).success,
    ).toBe(false);
  });

  it("exige categoryId no escopo CATEGORY", () => {
    expect(
      createPromotionSchema.safeParse({
        name: "Desconto",
        type: "PERCENTAGE",
        value: 10,
        scope: "CATEGORY",
      }).success,
    ).toBe(false);
  });
});
