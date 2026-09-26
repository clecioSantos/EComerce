import { describe, expect, it } from "vitest";

import {
  createAttributeSchema,
  createProductSchema,
  createProductTypeSchema,
  updateProductSchema,
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

const validUpdate = {
  id: "product_1",
  name: "Camiseta Oversized",
  slug: "camiseta-oversized",
  basePrice: 129.9,
  variants: [
    {
      id: "variant_1",
      sku: "CAM-PRETO-M",
      price: 129.9,
      weight: 0.3,
      width: 11,
      height: 17,
      length: 11,
      isActive: true,
    },
  ],
};

describe("updateProductSchema", () => {
  it("aceita um produto válido para edição", () => {
    const result = updateProductSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  it("exige ao menos uma variante", () => {
    const result = updateProductSchema.safeParse({ ...validUpdate, variants: [] });
    expect(result.success).toBe(false);
  });

  it("rejeita preço comparativo menor que o base", () => {
    const result = updateProductSchema.safeParse({
      ...validUpdate,
      basePrice: 100,
      compareAtPrice: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita peso/dimensão zero na variante", () => {
    const result = updateProductSchema.safeParse({
      ...validUpdate,
      variants: [{ ...validUpdate.variants[0], weight: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("aceita URL de imagem vazia (sem imagem)", () => {
    const result = updateProductSchema.safeParse({
      ...validUpdate,
      primaryImageUrl: "",
    });
    expect(result.success).toBe(true);
  });
});
