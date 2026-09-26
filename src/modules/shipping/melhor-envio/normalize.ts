import type { ShippingOption, ShippingPackage, ShippingServiceOption } from "../types";

import type { MelhorEnvioQuote, MelhorEnvioService } from "./types";

/** Converte preço (string/number) em number; aceita vírgula decimal. */
export function parseMoney(value: unknown): number | null {
  if (value == null) return null;
  const parsed =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDays(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function normalizeRange(
  range: MelhorEnvioQuote["delivery_range"],
): { min: number | null; max: number | null } | null {
  if (!range || typeof range !== "object") return null;
  const min = parseDays(range.min);
  const max = parseDays(range.max);
  if (min == null && max == null) return null;
  return { min, max };
}

function normalizePackages(raw: unknown): ShippingPackage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const packages: ShippingPackage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const pkg = item as {
      dimensions?: { height?: unknown; width?: unknown; length?: unknown };
      weight?: unknown;
      price?: unknown;
      insurance_value?: unknown;
    };
    const width = parseMoney(pkg.dimensions?.width);
    const height = parseMoney(pkg.dimensions?.height);
    const length = parseMoney(pkg.dimensions?.length);
    const weight = parseMoney(pkg.weight);
    if (width == null || height == null || length == null || weight == null) {
      continue;
    }
    packages.push({
      width,
      height,
      length,
      weight,
      price: parseMoney(pkg.price) ?? undefined,
      insuranceValue: parseMoney(pkg.insurance_value) ?? undefined,
    });
  }
  return packages.length > 0 ? packages : undefined;
}

/**
 * Normaliza a resposta bruta do Melhor Envio para o DTO interno.
 *
 * Prefere os valores customizados (`custom_price` / `custom_delivery_time` /
 * `custom_delivery_range`), conforme orientação da documentação, caindo para os
 * valores originais quando ausentes. Serviços com `error` ou sem preço são
 * descartados (não ficam disponíveis para o cliente).
 */
export function normalizeMelhorEnvioQuotes(
  raw: unknown,
  providerId: string,
): ShippingOption[] {
  if (!Array.isArray(raw)) return [];

  const options: ShippingOption[] = [];

  for (const entry of raw as MelhorEnvioQuote[]) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.error) continue;

    const price = parseMoney(entry.custom_price) ?? parseMoney(entry.price) ?? null;
    if (price == null) continue;

    const range =
      normalizeRange(entry.custom_delivery_range) ?? normalizeRange(entry.delivery_range);
    const deliveryTime =
      parseDays(entry.custom_delivery_time) ?? parseDays(entry.delivery_time);

    const min = range?.min ?? deliveryTime;
    const max = range?.max ?? deliveryTime;

    options.push({
      id: `${providerId}:${String(entry.id)}`,
      provider: providerId,
      label: entry.name?.trim() || `Serviço ${String(entry.id)}`,
      companyName: entry.company?.name?.trim() || undefined,
      price,
      estimatedDaysMin: min ?? undefined,
      estimatedDaysMax: max ?? undefined,
      packages: normalizePackages(entry.packages),
    });
  }

  return options;
}

/**
 * Normaliza a lista de serviços (`GET /api/v2/me/shipment/services`) para o DTO
 * interno usado nos checkboxes do painel administrativo.
 */
export function normalizeMelhorEnvioServices(raw: unknown): ShippingServiceOption[] {
  if (!Array.isArray(raw)) return [];

  const services: ShippingServiceOption[] = [];
  for (const entry of raw as MelhorEnvioService[]) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.id == null) continue;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (name.length === 0) continue;

    services.push({
      id: String(entry.id),
      name,
      companyName: entry.company?.name?.trim() || undefined,
    });
  }

  return services;
}
