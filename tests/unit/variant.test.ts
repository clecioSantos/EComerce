import { describe, expect, it } from "vitest";

import {
  buildVariantIndex,
  buildVariantMatrix,
  findDuplicateVariantSignatures,
  findVariantBySelection,
  generateVariantName,
  validateVariantSelection,
  variantSignature,
  type VariantLike,
} from "@/modules/products/variant";

function variant(id: string, sku: string, values: string[]): VariantLike {
  return {
    id,
    sku,
    attributeValues: values.map((attributeValueId, index) => ({
      attributeId: `attr${index}`,
      attributeValueId,
    })),
  };
}

describe("variantSignature", () => {
  it("é independente da ordem dos valores", () => {
    expect(variantSignature(["b", "a"])).toBe(variantSignature(["a", "b"]));
  });
});

describe("findVariantBySelection", () => {
  const variants = [
    variant("v1", "SKU-PRETO-P", ["preto", "p"]),
    variant("v2", "SKU-BRANCO-M", ["branco", "m"]),
  ];

  it("encontra a variante pela combinação exata", () => {
    expect(findVariantBySelection(variants, ["m", "branco"])?.id).toBe("v2");
  });

  it("retorna undefined quando não há combinação", () => {
    expect(findVariantBySelection(variants, ["preto", "m"])).toBeUndefined();
  });
});

describe("buildVariantIndex", () => {
  it("indexa variantes pela assinatura", () => {
    const index = buildVariantIndex([variant("v1", "S1", ["a", "b"])]);
    expect(index.get(variantSignature(["b", "a"]))?.id).toBe("v1");
  });
});

describe("validateVariantSelection", () => {
  const defining = [
    { id: "color", name: "Cor", isRequired: true },
    { id: "size", name: "Tamanho", isRequired: false },
  ];

  it("acusa atributos obrigatórios ausentes", () => {
    const result = validateVariantSelection(defining, [
      { attributeId: "size", attributeValueId: "m" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.missingAttributeIds).toEqual(["color"]);
  });

  it("valida quando todos os obrigatórios estão presentes", () => {
    const result = validateVariantSelection(defining, [
      { attributeId: "color", attributeValueId: "preto" },
    ]);
    expect(result.valid).toBe(true);
  });
});

describe("buildVariantMatrix", () => {
  it("gera o produto cartesiano das opções", () => {
    const combinations = buildVariantMatrix([
      { attributeId: "color", valueIds: ["preto", "branco"] },
      { attributeId: "size", valueIds: ["p", "m"] },
    ]);
    expect(combinations).toHaveLength(4);
    expect(combinations).toContainEqual(["preto", "p"]);
    expect(combinations).toContainEqual(["branco", "m"]);
  });
});

describe("findDuplicateVariantSignatures", () => {
  it("detecta combinações duplicadas", () => {
    const duplicates = findDuplicateVariantSignatures([
      variant("v1", "S1", ["a", "b"]),
      variant("v2", "S2", ["b", "a"]),
      variant("v3", "S3", ["c", "d"]),
    ]);
    expect(duplicates).toHaveLength(1);
  });
});

describe("generateVariantName", () => {
  it("junta rótulos com separador", () => {
    expect(generateVariantName(["Preto", "M"])).toBe("Preto / M");
  });
});
