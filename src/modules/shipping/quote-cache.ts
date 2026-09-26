import type { ShippingOption } from "./types";

/**
 * Cache em memória de TTL curto (60s) para cotações. Preços/prazos mudam com
 * frequência, então o objetivo é apenas evitar chamadas duplicadas durante o
 * checkout (ex.: SSR + cálculo no cliente para o mesmo destino), não cachear de
 * forma persistente. Uma cotação só colide quando origem, destino, itens e
 * serviços são idênticos — a chave inclui todos eles.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 100;

interface CacheEntry {
  options: ShippingOption[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function withQuoteCache(
  key: string,
  loader: () => Promise<ShippingOption[]>,
): Promise<ShippingOption[]> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.options;
  }

  const options = await loader();
  cache.set(key, { options, expiresAt: Date.now() + TTL_MS });

  if (cache.size > MAX_ENTRIES) {
    for (const [entryKey, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(entryKey);
    }
  }

  return options;
}
