import { describe, expect, it } from "vitest";

import {
  createAttributeSchema,
  createProductSchema,
  createProductTypeSchema,
} from "@/modules/products/schemas";

const validProduct = {
  name: "Camiseta Oversized",
  productTypeId: "type_1",
  basePrice: 129.9,
  variants: [
    {
      sku: "CAM-PRETO-M",
      attributeValueIds: ["value_preto", "value_m"],
    },
  ],
};

describe("createProductSchema", () => {
  it("aceita um produto válido", () => {
    const result = createProductSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("BRL");
      expect(result.data.status).toBe("DRAFT");
    }
  });

  it("exige ao menos uma variante", () => {
    const result = createProductSchema.safeParse({ ...validProduct, variants: [] });
    expect(result.success).toBe(false);
  });

  it("rejeita preço comparativo menor que o base", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      basePrice: 100,
      compareAtPrice: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita preço negativo", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      basePrice: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("createAttributeSchema", () => {
  it("rejeita allowMultiple em tipos não-multivalor", () => {
    const result = createAttributeSchema.safeParse({
      productTypeId: "type_1",
      name: "Peso",
      type: "NUMBER",
      allowMultiple: true,
    });
    expect(result.success).toBe(false);
  });

  it("aceita allowMultiple para MULTI_SELECT", () => {
    const result = createAttributeSchema.safeParse({
      productTypeId: "type_1",
      name: "Materiais",
      type: "MULTI_SELECT",
      allowMultiple: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("createProductTypeSchema", () => {
  it("aceita um tipo com atributos e valores", () => {
    const result = createProductTypeSchema.safeParse({
      name: "Roupas",
      attributes: [
        {
          name: "Cor",
          type: "SELECT",
          isVariantDefining: true,
          values: [{ value: "Preto" }, { value: "Branco" }],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attributes).toHaveLength(1);
      expect(result.data.attributes[0].values).toHaveLength(2);
    }
  });
});
