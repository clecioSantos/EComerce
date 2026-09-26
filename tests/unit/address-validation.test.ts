import { describe, expect, it } from "vitest";

import { addressSchema, updateAddressSchema } from "@/modules/customers/schemas";

const valid = {
  recipient: "Ana Souza",
  line1: "Rua das Flores, 123",
  city: "São Paulo",
  state: "SP",
  postalCode: "01018-020",
};

describe("addressSchema", () => {
  it("normaliza o CEP para dígitos e aplica padrões", () => {
    const result = addressSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.postalCode).toBe("01018020");
      expect(result.data.country).toBe("BR");
      expect(result.data.isDefault).toBe(false);
    }
  });

  it("rejeita CEP inválido", () => {
    expect(addressSchema.safeParse({ ...valid, postalCode: "123" }).success).toBe(false);
  });

  it("rejeita destinatário muito curto", () => {
    expect(addressSchema.safeParse({ ...valid, recipient: "A" }).success).toBe(false);
  });
});

describe("updateAddressSchema", () => {
  it("exige o id do endereço", () => {
    expect(updateAddressSchema.safeParse(valid).success).toBe(false);
    expect(updateAddressSchema.safeParse({ ...valid, id: "addr_1" }).success).toBe(true);
  });
});
