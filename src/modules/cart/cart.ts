/**
 * Regras de carrinho — independentes do tipo de produto.
 * O carrinho só conhece variantId/quantity; nenhuma regra de "roupas".
 */

export interface CartLine {
  variantId: string;
  quantity: number;
}

export const MAX_LINE_QUANTITY = 99;

export function clampQuantity(quantity: number, max = MAX_LINE_QUANTITY): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(max, Math.max(1, Math.floor(quantity)));
}

export function mergeCartLines(
  lines: CartLine[],
  incoming: CartLine,
): CartLine[] {
  const existing = lines.find((line) => line.variantId === incoming.variantId);
  if (!existing) {
    return [
      ...lines,
      { variantId: incoming.variantId, quantity: clampQuantity(incoming.quantity) },
    ];
  }
  return lines.map((line) =>
    line.variantId === incoming.variantId
      ? {
          ...line,
          quantity: clampQuantity(line.quantity + incoming.quantity),
        }
      : line,
  );
}

export function setLineQuantity(
  lines: CartLine[],
  variantId: string,
  quantity: number,
): CartLine[] {
  if (quantity <= 0) return removeCartLine(lines, variantId);
  return lines.map((line) =>
    line.variantId === variantId
      ? { ...line, quantity: clampQuantity(quantity) }
      : line,
  );
}

export function removeCartLine(
  lines: CartLine[],
  variantId: string,
): CartLine[] {
  return lines.filter((line) => line.variantId !== variantId);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function cartSubtotal(
  lines: { quantity: number; unitPrice: number }[],
): number {
  return Math.round(
    lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0) *
      100,
  ) / 100;
}
