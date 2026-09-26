import "server-only";

import { logger } from "@/lib/logger";

import { MELHOR_ENVIO_FALLBACK_SERVICES } from "../services";
import type { ShippingServiceOption } from "../types";

import { MelhorEnvioClient } from "./client";
import { normalizeMelhorEnvioServices } from "./normalize";

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { services: ShippingServiceOption[]; expiresAt: number } | null = null;

export interface MelhorEnvioServiceList {
  services: ShippingServiceOption[];
  source: "api" | "fallback";
}

/**
 * Lista os serviços disponíveis para configuração. Em caso de falha (sem token,
 * timeout, etc.), devolve a lista de contingência sem quebrar o painel.
 */
export async function listMelhorEnvioServices(): Promise<MelhorEnvioServiceList> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return { services: cache.services, source: "api" };
  }

  try {
    const client = new MelhorEnvioClient();
    const services = normalizeMelhorEnvioServices(await client.listServices());
    if (services.length === 0) {
      return { services: MELHOR_ENVIO_FALLBACK_SERVICES, source: "fallback" };
    }

    cache = { services, expiresAt: now + CACHE_TTL_MS };
    return { services, source: "api" };
  } catch (error) {
    logger.error({
      event: "SHIPPING_SERVICES_LIST_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
    return { services: MELHOR_ENVIO_FALLBACK_SERVICES, source: "fallback" };
  }
}
