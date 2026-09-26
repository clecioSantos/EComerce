import { getEnv } from "@/lib/env";

import { createMelhorEnvioProvider } from "./melhor-envio/provider";
import { FixedShippingProvider } from "./providers/fixed.provider";
import { PickupShippingProvider } from "./providers/pickup.provider";
import type { ShippingProvider, ShippingQuoteInput, ShippingOption } from "./types";

const registry = new Map<string, ShippingProvider>();

export function registerShippingProvider(provider: ShippingProvider): void {
  registry.set(provider.id, provider);
}

export function getShippingProvider(id: string): ShippingProvider {
  const provider = registry.get(id);
  if (!provider) {
    throw new Error(`Provedor de frete não registrado: "${id}".`);
  }
  return provider;
}

export function listShippingProviders(): ShippingProvider[] {
  return [...registry.values()];
}

export async function quoteShipping(
  input: ShippingQuoteInput,
): Promise<ShippingOption[]> {
  const provider = getShippingProvider(getEnv().SHIPPING_PROVIDER);
  return provider.quote(input);
}

// Providers disponíveis. O provider ativo é escolhido por SHIPPING_PROVIDER.
registerShippingProvider(
  new FixedShippingProvider({
    price: 19.9,
    freeAbove: 199,
    estimatedDaysMin: 3,
    estimatedDaysMax: 8,
  }),
);
registerShippingProvider(new PickupShippingProvider());
registerShippingProvider(createMelhorEnvioProvider());
