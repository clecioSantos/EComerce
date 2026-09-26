import { describe, expect, it } from "vitest";

import {
  calculatePricing,
  discountAmount,
  roundMoney,
  type PricingLineInput,
} from "@/modules/pricing/engine";

const lines: PricingLineInput[] = [
  { id: "a", productId: "p1", categoryId: "c1", unitPrice: 100, quantity: 2 },
  { id: "b", productId: "p2", categoryId: "c2", unitPrice: 50, quantity: 1 },
];

describe("pricing engine", () => {
  it("calcula o subtotal sem descontos", () => {
    const result = calculatePricing({ lines });
    expect(result.subtotal).toBe(250);
    expect(result.grandTotal).toBe(250);
    expect(result.discountTotal).toBe(0);
  });

  it("arredonda valores monetários para centavos", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(10.005)).toBe(10.01);
  });

  it("aplica promoção percentual de carrinho", () => {
    const result = calculatePricing({
      lines,
      promotions: [
        {
          id: "promo1",
          name: "10%",
          type: "PERCENTAGE",
          scope: "CART",
          value: 10,
          stackable: true,
          priority: 10,
        },
      ],
    });
    expect(result.promotionsDiscount).toBe(25);
    expect(result.grandTotal).toBe(225);
  });

  it("aplica desconto apenas em linhas da categoria", () => {
    const result = calculatePricing({
      lines,
      promotions: [
        {
          id: "promo-cat",
          name: "20% camisetas",
          type: "PERCENTAGE",
          scope: "CATEGORY",
          value: 20,
          categoryId: "c1",
          stackable: true,
          priority: 10,
        },
      ],
    });
    expect(result.promotionsDiscount).toBe(40);
    expect(result.lines.find((line) => line.id === "a")?.discount).toBe(40);
    expect(result.lines.find((line) => line.id === "b")?.discount).toBe(0);
  });

  it("limita desconto de valor fixo à base", () => {
    const result = calculatePricing({
      lines,
      promotions: [
        {
          id: "promo-fixed",
          name: "R$ 100 off",
          type: "FIXED_AMOUNT",
          scope: "PRODUCT",
          value: 100,
          productId: "p2",
          stackable: true,
          priority: 10,
        },
      ],
    });
    expect(result.promotionsDiscount).toBe(50);
  });

  it("não empilha promoções após uma não empilhável", () => {
    const result = calculatePricing({
      lines,
      promotions: [
        {
          id: "promo-first",
          name: "10%",
          type: "PERCENTAGE",
          scope: "CART",
          value: 10,
          stackable: false,
          priority: 30,
        },
        {
          id: "promo-second",
          name: "5%",
          type: "PERCENTAGE",
          scope: "CART",
          value: 5,
          stackable: true,
          priority: 20,
        },
      ],
    });
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.promotionsDiscount).toBe(25);
  });

  it("concede frete grátis sem descontar produtos", () => {
    const result = calculatePricing({
      lines,
      shippingCost: 30,
      promotions: [
        {
          id: "promo-ship",
          name: "Frete grátis",
          type: "FREE_SHIPPING",
          scope: "CART",
          value: 0,
          stackable: true,
          priority: 20,
        },
      ],
    });
    expect(result.freeShipping).toBe(true);
    expect(result.shippingDiscount).toBe(30);
    expect(result.grandTotal).toBe(250);
  });

  it("aplica cupom sobre o subtotal já descontado", () => {
    const result = calculatePricing({
      lines,
      promotions: [
        {
          id: "promo",
          name: "10%",
          type: "PERCENTAGE",
          scope: "CART",
          value: 10,
          stackable: true,
          priority: 10,
        },
      ],
      coupon: { code: "X", type: "PERCENTAGE", value: 10 },
    });
    expect(result.promotionsDiscount).toBe(25);
    expect(result.couponDiscount).toBe(22.5);
    expect(result.grandTotal).toBe(202.5);
  });

  it("ignora cupom quando o subtotal mínimo não é atingido", () => {
    const result = calculatePricing({
      lines,
      coupon: { code: "X", type: "PERCENTAGE", value: 50, minSubtotal: 1000 },
    });
    expect(result.couponDiscount).toBe(0);
  });

  it("cupom de frete grátis zera o frete sem descontar produtos", () => {
    const result = calculatePricing({
      lines,
      shippingCost: 30,
      coupon: { code: "FRETEZERO", type: "FREE_SHIPPING", value: 0 },
    });
    expect(result.couponDiscount).toBe(0);
    expect(result.freeShipping).toBe(true);
    expect(result.shippingDiscount).toBe(30);
    expect(result.grandTotal).toBe(250);
  });

  it("não aplica cupom de frete grátis abaixo do subtotal mínimo", () => {
    const result = calculatePricing({
      lines,
      shippingCost: 30,
      coupon: {
        code: "FRETEZERO",
        type: "FREE_SHIPPING",
        value: 0,
        minSubtotal: 1000,
      },
    });
    expect(result.freeShipping).toBe(false);
    expect(result.shippingDiscount).toBe(0);
    expect(result.grandTotal).toBe(280);
  });

  it("respeita o mínimo de subtotal e quantidade das promoções", () => {
    const result = calculatePricing({
      lines,
      promotions: [
        {
          id: "min",
          name: "min",
          type: "PERCENTAGE",
          scope: "CART",
          value: 10,
          minSubtotal: 1000,
          minQuantity: 10,
          stackable: true,
          priority: 10,
        },
      ],
    });
    expect(result.promotionsDiscount).toBe(0);
  });

  it("a soma dos descontos das linhas é igual ao total descontado", () => {
    const result = calculatePricing({
      lines,
      coupon: { code: "X", type: "FIXED_AMOUNT", value: 37.77 },
    });
    const sum = result.lines.reduce((total, line) => total + line.discount, 0);
    expect(roundMoney(sum)).toBe(result.discountTotal);
  });
});

describe("discountAmount", () => {
  it("calcula percentual, valor fixo e frete", () => {
    expect(discountAmount("PERCENTAGE", 10, 200)).toBe(20);
    expect(discountAmount("FIXED_AMOUNT", 30, 200)).toBe(30);
    expect(discountAmount("FIXED_AMOUNT", 300, 200)).toBe(200);
    expect(discountAmount("FREE_SHIPPING", 0, 200)).toBe(0);
  });
});

describe("precisão decimal", () => {
  it("0.1 * 3 não gera erro de ponto flutuante", () => {
    const result = calculatePricing({
      lines: [{ id: "a", productId: "p1", unitPrice: 0.1, quantity: 3 }],
    });
    expect(result.subtotal).toBe(0.3);
    expect(result.grandTotal).toBe(0.3);
  });

  it("percentual sobre valor fracionário é exato", () => {
    const result = calculatePricing({
      lines: [{ id: "a", productId: "p1", unitPrice: 19.99, quantity: 3 }],
      promotions: [
        {
          id: "p",
          name: "10%",
          type: "PERCENTAGE",
          scope: "CART",
          value: 10,
          stackable: true,
          priority: 1,
        },
      ],
    });
    // 19.99 * 3 = 59.97 ; 10% = 5.997 -> 6.00
    expect(result.subtotal).toBe(59.97);
    expect(result.promotionsDiscount).toBe(6);
    expect(result.grandTotal).toBe(53.97);
  });

  it("soma de valores fracionários fecha exatamente", () => {
    const result = calculatePricing({
      lines: [
        { id: "a", productId: "p1", unitPrice: 0.1, quantity: 1 },
        { id: "b", productId: "p2", unitPrice: 0.2, quantity: 1 },
      ],
    });
    expect(result.subtotal).toBe(0.3);
  });
});
