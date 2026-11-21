import { describe, expect, it } from "vitest";
import {
  assertCapacity,
  effectiveLimits,
  moneySum,
  overdue,
  profileSchema,
  settingsSchema,
  unresolved,
} from "@/modules/conditional/rules";
const caps = {
  maxOpenAmount: 2000,
  maxOpenUnits: 8,
  maxCaseAmount: 1500,
  maxCaseUnits: 5,
  maxOpenCases: 2,
};
const usage = { amount: 750, units: 3, cases: 1, blocked: false };
describe("limites de condicional", () => {
  it("aplica o menor teto da loja e da cliente", () =>
    expect(
      effectiveLimits(caps, { ...caps, maxOpenAmount: 3000, maxCaseUnits: 3 }),
    ).toEqual({ ...caps, maxCaseUnits: 3 }));
  it("aceita exatamente o saldo restante", () =>
    expect(() => assertCapacity(caps, usage, 1250, 5)).not.toThrow());
  it.each([
    [1250.01, 1],
    [100, 6],
    [1500.01, 1],
  ])("rejeita excesso de valor ou peças (%s, %s)", (amount, units) =>
    expect(() => assertCapacity(caps, usage, amount, units)).toThrow(),
  );
  it("conta operações abertas e pendências", () => {
    expect(() => assertCapacity(caps, { ...usage, cases: 2 }, 100, 1)).toThrow();
    expect(() => assertCapacity(caps, { ...usage, blocked: true }, 100, 1)).toThrow();
  });
  it("zero não concede capacidade ilimitada", () =>
    expect(() =>
      assertCapacity(
        { ...caps, maxOpenAmount: 0 },
        { amount: 0, units: 0, cases: 0, blocked: false },
        1,
        1,
      ),
    ).toThrow());
  it("não libera compromisso por mera declaração de retorno", () =>
    expect(
      unresolved({
        quantity: 5,
        soldQuantity: 2,
        approvedReturnQuantity: 0,
        writtenOffQuantity: 0,
      }),
    ).toBe(3));
  it("calcula dinheiro sem somar erros de ponto flutuante", () =>
    expect(
      moneySum([
        { unitPrice: 0.1, quantity: 1 },
        { unitPrice: 0.2, quantity: 1 },
      ]),
    ).toBe(0.3));
  it("exige limites positivos para habilitar o cadastro", () =>
    expect(
      profileSchema.safeParse({
        ...caps,
        maxOpenUnits: 0,
        userId: "a",
        eligibility: "ELIGIBLE",
        eligibleUntil: null,
        notes: "",
        reason: "Avaliação manual",
      }).success,
    ).toBe(false));
  it("exige políticas completas ao habilitar a loja", () =>
    expect(
      settingsSchema.safeParse({
        ...caps,
        enabled: true,
        totalDays: 3,
        reserveHours: 24,
        requestHours: 48,
        terms: "",
        freightPolicy: "",
        customerPaysShipping: false,
        returnFee: 0,
        reason: "Configuração",
      }).success,
    ).toBe(false));
  it("prazo vencido não é uma venda nem um retorno", () => {
    const row = {
      status: "RECEIVED",
      issue: null,
      choiceDueAt: new Date(0),
      returnDueAt: null,
      paymentDueAt: null,
      items: [],
    };
    expect(overdue(row)).toBe(true);
    expect(row.status).toBe("RECEIVED");
  });
});
