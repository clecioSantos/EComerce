import { describe, expect, it } from "vitest";

import { parseDecimalInput } from "@/lib/format";

describe("parseDecimalInput", () => {
  it("aceita ponto como separador", () => {
    expect(parseDecimalInput("0.3")).toBe(0.3);
  });

  it("aceita vírgula como separador (pt-BR)", () => {
    expect(parseDecimalInput("0,3")).toBe(0.3);
    expect(parseDecimalInput("17,5")).toBe(17.5);
  });

  it("aceita inteiros", () => {
    expect(parseDecimalInput("17")).toBe(17);
  });

  it("retorna null para vazio ou inválido", () => {
    expect(parseDecimalInput("  ")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNull();
  });
});
