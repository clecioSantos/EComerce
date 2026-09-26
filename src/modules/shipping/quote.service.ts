import "server-only";

import { getEnv } from "@/lib/env";
import { getStoreSettings } from "@/modules/settings/store-settings.service";

import {
  buildShippingItems,
  sumShippingItemsSubtotal,
  type ShippingCartItemInput,
} from "./mappers";
import { withQuoteCache } from "./quote-cache";
import { pickupShippingOption } from "./providers/pickup.provider";
import { getShippingProvider } from "./registry";
import { isValidCep, onlyDigits } from "./schemas";
import { mergeShippingOptions } from "./services";
import type { ShippingOption } from "./types";

export { buildShippingItems, sumShippingItemsSubtotal };
export type { ShippingCartItemInput };

export interface QuoteShippingForItemsParams {
  items: ReturnType<typeof buildShippingItems>;
  subtotal: number;
  destinationPostalCode?: string | null;
}

/**
 * Cotação server-side: usa o endereço de origem da loja, os serviços
 * habilitados e os dados logísticos vindos do banco. Sem CEP de destino válido
 * não há cotação.
 */
export async function quoteShippingForItems(
  params: QuoteShippingForItemsParams,
): Promise<ShippingOption[]> {
  const destination = params.destinationPostalCode
    ? onlyDigits(params.destinationPostalCode)
    : "";
  if (!isValidCep(destination) || params.items.length === 0) return [];

  const settings = await getStoreSettings();
  const originPostalCode = settings?.postalCode ?? null;
  const services = settings?.shippingServiceIds ?? [];

  const provider = getShippingProvider(getEnv().SHIPPING_PROVIDER);

  const cacheKey = JSON.stringify({
    provider: provider.id,
    origin: originPostalCode,
    destination,
    services,
    items: params.items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      weight: item.weight,
      width: item.width,
      height: item.height,
      length: item.length,
      unitPrice: item.unitPrice,
    })),
  });

  const options = await withQuoteCache(cacheKey, () =>
    provider.quote({
      origin: originPostalCode ? { postalCode: originPostalCode } : null,
      address: { postalCode: destination },
      items: params.items,
      subtotal: params.subtotal,
      services,
    }),
  );

  // Retirada na loja está sempre disponível (frete grátis), além das opções
  // cotadas no Melhor Envio.
  return mergeShippingOptions(options, [pickupShippingOption()]);
}
