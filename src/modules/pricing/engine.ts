import { Decimal } from "decimal.js";

/**
 * Domínio de precificação — puro, determinístico e independente de banco.
 *
 * Toda a aritmética monetária acontece internamente em `Decimal` (decimal.js),
 * evitando erros de ponto flutuante. A API pública permanece em `number` para
 * não quebrar os consumidores (checkout, carrinho, persistência Prisma), que já
 * convertem para `Decimal` do banco.
 */

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
export type DiscountScope = "CART" | "CATEGORY" | "PRODUCT";

export interface PricingLineInput {
  id: string;
  productId: string;
  categoryId?: string | null;
  unitPrice: number;
  quantity: number;
}

export interface PromotionRule {
  id: string;
  name: string;
  type: DiscountType;
  scope: DiscountScope;
  value: number;
  categoryId?: string | null;
  productId?: string | null;
  minSubtotal?: number | null;
  minQuantity?: number | null;
  stackable: boolean;
  priority: number;
}

export interface CouponRule {
  code: string;
  type: DiscountType;
  value: number;
  minSubtotal?: number | null;
}

export interface PricingInput {
  lines: PricingLineInput[];
  promotions?: PromotionRule[];
  coupon?: CouponRule | null;
  shippingCost?: number;
}

export interface PricingLineResult {
  id: string;
  subtotal: number;
  discount: number;
  total: number;
  appliedDiscountIds: string[];
}

export interface AppliedDiscount {
  id: string;
  name: string;
  amount: number;
}

export interface PricingResult {
  subtotal: number;
  discountTotal: number;
  couponDiscount: number;
  promotionsDiscount: number;
  shippingCost: number;
  shippingDiscount: number;
  grandTotal: number;
  freeShipping: boolean;
  appliedPromotions: AppliedDiscount[];
  lines: PricingLineResult[];
}

type Numeric = number | string | Decimal;

function dec(value: Numeric): Decimal {
  return new Decimal(value);
}

/** Arredonda para centavos (HALF_UP). */
export function roundMoney(value: number): number {
  return moneyDecimal(dec(value)).toNumber();
}

/** Multiplica preço unitário por quantidade usando precisão decimal. */
export function multiplyMoney(unitPrice: number, quantity: number): number {
  return moneyDecimal(dec(unitPrice).times(dec(quantity))).toNumber();
}

function moneyDecimal(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function lineSubtotalDecimal(line: PricingLineInput): Decimal {
  return dec(line.unitPrice).times(dec(line.quantity));
}

export function lineSubtotal(line: PricingLineInput): number {
  return moneyDecimal(lineSubtotalDecimal(line)).toNumber();
}

function eligibleLines(
  lines: PricingLineInput[],
  rule: Pick<PromotionRule, "scope" | "categoryId" | "productId">,
): PricingLineInput[] {
  switch (rule.scope) {
    case "CATEGORY":
      return lines.filter((line) => line.categoryId === rule.categoryId);
    case "PRODUCT":
      return lines.filter((line) => line.productId === rule.productId);
    case "CART":
    default:
      return lines;
  }
}

function sumBaseDecimal(lines: PricingLineInput[]): Decimal {
  return lines.reduce(
    (total, line) => total.plus(lineSubtotalDecimal(line)),
    new Decimal(0),
  );
}

function sumLineDiscountsDecimal(
  lines: PricingLineInput[],
  discounts: Map<string, Decimal>,
): Decimal {
  return lines.reduce(
    (total, line) => total.plus(discounts.get(line.id) ?? 0),
    new Decimal(0),
  );
}

function isEligible(
  rule: PromotionRule,
  lines: PricingLineInput[],
  subtotal: number,
  quantity: number,
): boolean {
  if (rule.scope !== "CART" && eligibleLines(lines, rule).length === 0) {
    return false;
  }
  if (rule.minSubtotal != null && subtotal < rule.minSubtotal) {
    return false;
  }
  if (rule.minQuantity != null && quantity < rule.minQuantity) {
    return false;
  }
  return true;
}

function discountAmountDecimal(
  type: DiscountType,
  value: Numeric,
  base: Decimal,
): Decimal {
  if (base.lte(0)) return new Decimal(0);
  if (type === "PERCENTAGE") {
    return moneyDecimal(base.times(dec(value)).div(100));
  }
  if (type === "FIXED_AMOUNT") {
    return moneyDecimal(Decimal.min(dec(value), base));
  }
  return new Decimal(0); // FREE_SHIPPING não desconta produtos
}

/** Calcula o desconto monetário de uma regra sobre uma base. */
export function discountAmount(type: DiscountType, value: number, base: number): number {
  return discountAmountDecimal(type, value, dec(base)).toNumber();
}

/** Distribui um desconto proporcional entre linhas elegíveis. */
function distributeDiscount(
  lines: PricingLineInput[],
  totalDiscount: number,
): Map<string, number> {
  const distribution = new Map<string, number>();
  const baseDec = sumBaseDecimal(lines);
  const totalDec = dec(totalDiscount);

  if (baseDec.lte(0) || totalDec.lte(0)) {
    for (const line of lines) distribution.set(line.id, 0);
    return distribution;
  }

  let assigned = new Decimal(0);
  lines.forEach((line, index) => {
    const isLast = index === lines.length - 1;
    const share = isLast
      ? moneyDecimal(totalDec.minus(assigned))
      : moneyDecimal(totalDec.times(lineSubtotalDecimal(line)).div(baseDec));
    assigned = assigned.plus(share);
    distribution.set(line.id, share.toNumber());
  });

  return distribution;
}

export function calculatePricing(input: PricingInput): PricingResult {
  const { lines, promotions = [], coupon, shippingCost = 0 } = input;

  const subtotalDec = sumBaseDecimal(lines);
  const subtotal = moneyDecimal(subtotalDec).toNumber();
  const quantity = lines.reduce((total, line) => total + line.quantity, 0);

  const lineDiscounts = new Map<string, Decimal>();
  const lineApplied = new Map<string, string[]>();
  for (const line of lines) {
    lineDiscounts.set(line.id, new Decimal(0));
    lineApplied.set(line.id, []);
  }

  const appliedPromotions: AppliedDiscount[] = [];
  let promotionsDiscountDec = new Decimal(0);
  let freeShipping = false;
  let stackAllowed = true;

  const orderedPromotions = [...promotions].sort((a, b) => b.priority - a.priority);

  for (const rule of orderedPromotions) {
    if (!stackAllowed) break;
    if (rule.type === "FREE_SHIPPING") {
      if (!isEligible(rule, lines, subtotal, quantity)) continue;
      freeShipping = true;
      appliedPromotions.push({ id: rule.id, name: rule.name, amount: 0 });
      if (!rule.stackable) stackAllowed = false;
      continue;
    }

    if (!isEligible(rule, lines, subtotal, quantity)) continue;

    const target = eligibleLines(lines, rule);
    const baseDec = sumBaseDecimal(target);
    const remainingBaseDec = Decimal.max(
      new Decimal(0),
      baseDec.minus(sumLineDiscountsDecimal(target, lineDiscounts)),
    );
    const amount = discountAmountDecimal(rule.type, rule.value, remainingBaseDec);
    if (amount.lte(0)) continue;

    const distribution = distributeDiscount(target, amount.toNumber());
    for (const line of target) {
      const current = lineDiscounts.get(line.id) ?? new Decimal(0);
      lineDiscounts.set(line.id, current.plus(distribution.get(line.id) ?? 0));
      lineApplied.set(line.id, [...(lineApplied.get(line.id) ?? []), rule.id]);
    }

    promotionsDiscountDec = promotionsDiscountDec.plus(amount);
    appliedPromotions.push({ id: rule.id, name: rule.name, amount: amount.toNumber() });
    if (!rule.stackable) stackAllowed = false;
  }

  // Cupom é calculado sobre o subtotal já descontado pelas promoções.
  let couponDiscountDec = new Decimal(0);
  if (coupon) {
    const couponBaseDec = subtotalDec.minus(promotionsDiscountDec);
    if (coupon.minSubtotal == null || subtotal >= coupon.minSubtotal) {
      if (coupon.type === "FREE_SHIPPING") {
        // Cupom de frete grátis: não desconta produtos, mas zera o frete.
        freeShipping = true;
      } else {
        couponDiscountDec = discountAmountDecimal(
          coupon.type,
          coupon.value,
          couponBaseDec,
        );
      }
    }
    if (couponDiscountDec.gt(0)) {
      const distribution = distributeDiscount(lines, couponDiscountDec.toNumber());
      for (const line of lines) {
        const current = lineDiscounts.get(line.id) ?? new Decimal(0);
        lineDiscounts.set(line.id, current.plus(distribution.get(line.id) ?? 0));
        lineApplied.set(line.id, [
          ...(lineApplied.get(line.id) ?? []),
          `coupon:${coupon.code}`,
        ]);
      }
    }
  }

  const discountTotalDec = promotionsDiscountDec.plus(couponDiscountDec);
  const shippingDiscountDec = freeShipping ? dec(shippingCost) : new Decimal(0);
  const grandTotalDec = Decimal.max(
    new Decimal(0),
    subtotalDec.minus(discountTotalDec),
  ).plus(Decimal.max(new Decimal(0), dec(shippingCost).minus(shippingDiscountDec)));

  const lineResults: PricingLineResult[] = lines.map((line) => {
    const discount = lineDiscounts.get(line.id) ?? new Decimal(0);
    const lineTotalDec = lineSubtotalDecimal(line);
    return {
      id: line.id,
      subtotal: moneyDecimal(lineTotalDec).toNumber(),
      discount: moneyDecimal(discount).toNumber(),
      total: moneyDecimal(
        Decimal.max(new Decimal(0), lineTotalDec.minus(discount)),
      ).toNumber(),
      appliedDiscountIds: lineApplied.get(line.id) ?? [],
    };
  });

  return {
    subtotal,
    discountTotal: moneyDecimal(discountTotalDec).toNumber(),
    couponDiscount: moneyDecimal(couponDiscountDec).toNumber(),
    promotionsDiscount: moneyDecimal(promotionsDiscountDec).toNumber(),
    shippingCost: moneyDecimal(dec(shippingCost)).toNumber(),
    shippingDiscount: moneyDecimal(shippingDiscountDec).toNumber(),
    grandTotal: moneyDecimal(grandTotalDec).toNumber(),
    freeShipping,
    appliedPromotions,
    lines: lineResults,
  };
}
