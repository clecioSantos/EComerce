import { describe, expect, it } from "vitest";

import {
  cepSchema,
  isValidCep,
  shippingQuoteRequestSchema,
  storeSettingsSchema,
} from "@/modules/shipping/schemas";
import { variantLogisticsSchema } from "@/modules/products/schemas";

describe("cepSchema", () => {
  it("normaliza CEP com máscara para dígitos", () => {
    const result = cepSchema.safeParse("01018-020");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("01018020");
  });

  it("aceita CEP já sem máscara", () => {
    const result = cepSchema.safeParse("01018020");
    expect(result.success).toBe(true);
  });

  it("rejeita CEP incompleto", () => {
    expect(cepSchema.safeParse("01018-02").success).toBe(false);
    expect(cepSchema.safeParse("123").success).toBe(false);
  });

  it("isValidCep aceita máscara e rejeita lixo", () => {
    expect(isValidCep("01018-020")).toBe(true);
    expect(isValidCep("abcdefgh")).toBe(false);
  });
});

describe("shippingQuoteRequestSchema", () => {
  it("aceita e normaliza o CEP de destino", () => {
    const result = shippingQuoteRequestSchema.safeParse({ postalCode: "01018-020" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.postalCode).toBe("01018020");
  });

  it("rejeita corpo sem CEP", () => {
    expect(shippingQuoteRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("storeSettingsSchema", () => {
  const valid = {
    postalCode: "01018-020",
    street: "Rua das Flores",
    number: "123",
    complement: null,
    district: "Centro",
    city: "São Paulo",
    state: "SP",
    shippingServiceIds: ["1", "2"],
  };

  it("aceita configuração válida e normaliza o CEP", () => {
    const result = storeSettingsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.postalCode).toBe("01018020");
  });

  it("exige CEP de origem válido", () => {
    expect(storeSettingsSchema.safeParse({ ...valid, postalCode: "1" }).success).toBe(
      false,
    );
  });
});

describe("variantLogisticsSchema", () => {
  it("aceita peso e dimensões positivos", () => {
    const result = variantLogisticsSchema.safeParse({
      variantId: "v1",
      weight: 0.3,
      width: 11,
      height: 17,
      length: 11,
    });
    expect(result.success).toBe(true);
  });

  it("aceita dados ausentes (variante ainda não cadastrada)", () => {
    expect(variantLogisticsSchema.safeParse({ variantId: "v1" }).success).toBe(true);
  });

  it("rejeita peso inválido (zero/negativo)", () => {
    expect(variantLogisticsSchema.safeParse({ variantId: "v1", weight: 0 }).success).toBe(
      false,
    );
    expect(
      variantLogisticsSchema.safeParse({ variantId: "v1", weight: -1 }).success,
    ).toBe(false);
  });

  it("rejeita dimensão inválida", () => {
    expect(
      variantLogisticsSchema.safeParse({ variantId: "v1", height: -5 }).success,
    ).toBe(false);
  });
});
