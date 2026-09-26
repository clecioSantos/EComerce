import type { MissingLogisticsEntry } from "../errors";
import type { ShippingItem } from "../types";

import type { MelhorEnvioCalculateRequest, MelhorEnvioProduct } from "./types";

/** `AppName (email@contato)` — exigido pela API do Melhor Envio. */
export function buildUserAgent(name: string, email?: string | null): string {
  const trimmed = name.trim();
  return email && email.trim().length > 0 ? `${trimmed} (${email.trim()})` : trimmed;
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Identifica variantes sem peso/dimensões válidos (não usa valores fictícios). */
export function collectMissingLogistics(items: ShippingItem[]): MissingLogisticsEntry[] {
  const missing: MissingLogisticsEntry[] = [];

  for (const item of items) {
    const fields: string[] = [];
    if (!isPositive(item.weight)) fields.push("weight");
    if (!isPositive(item.width)) fields.push("width");
    if (!isPositive(item.height)) fields.push("height");
    if (!isPositive(item.length)) fields.push("length");

    if (fields.length > 0) {
      missing.push({
        variantId: item.variantId,
        sku: item.sku ?? null,
        missing: fields,
      });
    }
  }

  return missing;
}

/** Converte itens do domínio para o formato `products` do Melhor Envio. */
export function toMelhorEnvioProducts(items: ShippingItem[]): MelhorEnvioProduct[] {
  return items.map((item) => ({
    id: item.sku && item.sku.length > 0 ? item.sku : item.variantId,
    width: Number(item.width),
    height: Number(item.height),
    length: Number(item.length),
    weight: Number(item.weight),
    insurance_value: round2(item.unitPrice ?? 0),
    quantity: item.quantity,
  }));
}

export interface BuildRequestParams {
  originPostalCode: string;
  destinationPostalCode: string;
  items: ShippingItem[];
  services: string[];
  receipt?: boolean;
  ownHand?: boolean;
}

export function buildMelhorEnvioRequest(
  params: BuildRequestParams,
): MelhorEnvioCalculateRequest {
  return {
    from: { postal_code: params.originPostalCode },
    to: { postal_code: params.destinationPostalCode },
    products: toMelhorEnvioProducts(params.items),
    options: {
      receipt: params.receipt ?? false,
      own_hand: params.ownHand ?? false,
    },
    services: params.services.join(","),
  };
}
