import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { logger } from "@/lib/logger";
import { getActiveCart } from "@/modules/cart/cart.service";
import {
  isShippingError,
  MissingShippingDataError,
  SHIPPING_MESSAGES,
  type ShippingErrorCode,
} from "@/modules/shipping/errors";
import {
  buildShippingItems,
  quoteShippingForItems,
  sumShippingItemsSubtotal,
} from "@/modules/shipping/quote.service";
import { shippingQuoteRequestSchema } from "@/modules/shipping/schemas";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<ShippingErrorCode, number> = {
  INVALID_POSTAL_CODE: 400,
  EMPTY_CART: 400,
  ORIGIN_NOT_CONFIGURED: 503,
  MISSING_LOGISTICS: 422,
  NO_SERVICES: 503,
  PROVIDER_AUTH: 502,
  PROVIDER_TIMEOUT: 504,
  PROVIDER_UNAVAILABLE: 502,
  INVALID_RESPONSE: 502,
  UNKNOWN: 500,
};

function errorResponse(code: ShippingErrorCode) {
  return NextResponse.json(
    { ok: false, code, error: SHIPPING_MESSAGES[code] },
    { status: STATUS_BY_CODE[code] },
  );
}

/**
 * POST /api/shipping/quote
 *
 * Recebe apenas o CEP de destino. Peso, dimensões, preço e quantidade vêm do
 * carrinho persistido no banco — nunca do corpo da requisição.
 */
export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("INVALID_POSTAL_CODE");
  }

  const parsed = shippingQuoteRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse("INVALID_POSTAL_CODE");
  }

  const productNameByVariant = new Map<string, string>();

  try {
    const session = await getSession();
    const cart = await getActiveCart(session?.user?.id);
    if (!cart || cart.items.length === 0) {
      return errorResponse("EMPTY_CART");
    }

    for (const item of cart.items) {
      productNameByVariant.set(item.variantId, item.product.name);
    }

    logger.info({
      event: "SHIPPING_QUOTE_RECEIVED",
      postalCode: parsed.data.postalCode,
      items: cart.items.length,
    });

    const items = buildShippingItems(cart.items);
    const options = await quoteShippingForItems({
      items,
      subtotal: sumShippingItemsSubtotal(items),
      destinationPostalCode: parsed.data.postalCode,
    });

    return NextResponse.json({
      ok: true,
      postalCode: parsed.data.postalCode,
      options,
    });
  } catch (error) {
    if (error instanceof MissingShippingDataError) {
      // Diagnóstico para o administrador: produto, variante/SKU e campos que
      // faltam. Nunca é exposto ao cliente.
      logger.error({
        event: "SHIPPING_QUOTE_MISSING_LOGISTICS",
        variants: error.variants.map((entry) => ({
          ...entry,
          productName: productNameByVariant.get(entry.variantId) ?? null,
        })),
      });
      return errorResponse("MISSING_LOGISTICS");
    }

    const code = isShippingError(error) ? error.code : "UNKNOWN";
    logger.error({
      event: "SHIPPING_QUOTE_FAILED",
      code,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(code);
  }
}
