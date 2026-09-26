import type { Prisma } from "@/generated/prisma/client";
import { multiplyMoney, roundMoney } from "@/modules/pricing/engine";

import type { ShippingItem } from "./types";

type NumericInput = Prisma.Decimal | number | string | null | undefined;

function toNumberOrNull(value: NumericInput): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Item de carrinho com os dados logísticos da variante. */
export interface ShippingCartItemInput {
  variantId: string;
  quantity: number;
  variant: {
    sku: string;
    price: NumericInput;
    weight: NumericInput;
    width: NumericInput;
    height: NumericInput;
    length: NumericInput;
  };
  product: { basePrice: NumericInput };
}

/**
 * Mapeia itens do carrinho para o formato de cotação. A fonte é sempre o banco:
 * pesos/dimensões/preços nunca vêm do cliente.
 */
export function buildShippingItems(items: ShippingCartItemInput[]): ShippingItem[] {
  return items.map((item) => ({
    variantId: item.variantId,
    sku: item.variant.sku,
    quantity: item.quantity,
    unitPrice:
      toNumberOrNull(item.variant.price) ?? toNumberOrNull(item.product.basePrice) ?? 0,
    weight: toNumberOrNull(item.variant.weight),
    width: toNumberOrNull(item.variant.width),
    height: toNumberOrNull(item.variant.height),
    length: toNumberOrNull(item.variant.length),
  }));
}

export function sumShippingItemsSubtotal(items: ShippingItem[]): number {
  return roundMoney(
    items.reduce(
      (total, item) => total + multiplyMoney(item.unitPrice ?? 0, item.quantity),
      0,
    ),
  );
}
