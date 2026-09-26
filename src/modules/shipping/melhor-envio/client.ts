import "server-only";

import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

import { ShippingError } from "../errors";

import { buildUserAgent } from "./request";
import type {
  MelhorEnvioCalculateRequest,
  MelhorEnvioCalculator,
  MelhorEnvioConfig,
  MelhorEnvioQuote,
} from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_LOG_BODY = 2_000;

/** Trunca o corpo da resposta para não poluir o log. */
function truncateForLog(body: string): string {
  return body.length > MAX_LOG_BODY ? `${body.slice(0, MAX_LOG_BODY)}… (truncado)` : body;
}

/** Lê a configuração do Melhor Envio do ambiente (token nunca é logado). */
export function getMelhorEnvioConfig(): MelhorEnvioConfig {
  const env = getEnv();
  const token = env.TOKEN_MELHOR_ENVIO;
  if (!token) {
    throw new ShippingError(
      "PROVIDER_AUTH",
      "TOKEN_MELHOR_ENVIO não configurado no servidor.",
    );
  }

  return {
    baseUrl: env.MELHOR_ENVIO_API_URL.replace(/\/+$/, ""),
    token,
    userAgent: buildUserAgent(
      env.MELHOR_ENVIO_USER_AGENT,
      env.MELHOR_ENVIO_USER_AGENT_EMAIL,
    ),
  };
}

/**
 * Cliente HTTP do Melhor Envio. Centraliza a autenticação e o tratamento de
 * erros; nenhuma outra parte da aplicação chama a API externa diretamente.
 */
export class MelhorEnvioClient implements MelhorEnvioCalculator {
  private config: MelhorEnvioConfig | null;

  constructor(config?: MelhorEnvioConfig) {
    this.config = config ?? null;
  }

  /** Resolve a configuração de forma preguiçosa (não quebra build sem token). */
  private resolveConfig(): MelhorEnvioConfig {
    if (!this.config) this.config = getMelhorEnvioConfig();
    return this.config;
  }

  async calculate(request: MelhorEnvioCalculateRequest): Promise<MelhorEnvioQuote[]> {
    const config = this.resolveConfig();
    const url = `${config.baseUrl}/api/v2/me/shipment/calculate`;

    // Log do pacote enviado (sem credenciais): CEPs, produtos, pesos/dimensões,
    // valor segurado, quantidades, serviços e opções.
    logger.info({
      event: "SHIPPING_QUOTE_REQUEST",
      provider: "melhor-envio",
      url,
      payload: request,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.token}`,
          "User-Agent": config.userAgent,
        },
        body: JSON.stringify(request),
        cache: "no-store",
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new ShippingError(
          "PROVIDER_TIMEOUT",
          "O Melhor Envio não respondeu a tempo.",
          { cause: error },
        );
      }
      throw new ShippingError(
        "PROVIDER_UNAVAILABLE",
        "Não foi possível contatar o Melhor Envio.",
        { cause: error },
      );
    }

    const rawBody = await response.text().catch(() => "");

    if (response.status === 401 || response.status === 403) {
      logger.error({
        event: "SHIPPING_QUOTE_RESPONSE",
        provider: "melhor-envio",
        status: response.status,
        body: truncateForLog(rawBody),
      });
      throw new ShippingError(
        "PROVIDER_AUTH",
        "Falha de autenticação com o Melhor Envio.",
      );
    }

    if (!response.ok) {
      logger.error({
        event: "SHIPPING_QUOTE_RESPONSE",
        provider: "melhor-envio",
        status: response.status,
        body: truncateForLog(rawBody),
      });
      throw new ShippingError(
        "PROVIDER_UNAVAILABLE",
        `O Melhor Envio respondeu com status ${response.status}.`,
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch (error) {
      logger.error({
        event: "SHIPPING_QUOTE_RESPONSE",
        provider: "melhor-envio",
        status: response.status,
        body: truncateForLog(rawBody),
      });
      throw new ShippingError(
        "INVALID_RESPONSE",
        "Resposta inesperada do Melhor Envio.",
        { cause: error },
      );
    }

    if (!Array.isArray(data)) {
      logger.error({
        event: "SHIPPING_QUOTE_RESPONSE",
        provider: "melhor-envio",
        status: response.status,
        body: truncateForLog(rawBody),
      });
      throw new ShippingError("INVALID_RESPONSE", "Resposta inesperada do Melhor Envio.");
    }

    logger.info({
      event: "SHIPPING_QUOTE_RESPONSE",
      provider: "melhor-envio",
      status: response.status,
      quotes: data.length,
    });

    return data as MelhorEnvioQuote[];
  }

  /** Lista os serviços de transportadoras disponíveis para configuração. */
  async listServices(): Promise<unknown> {
    const config = this.resolveConfig();
    const url = `${config.baseUrl}/api/v2/me/shipment/services`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.token}`,
          "User-Agent": config.userAgent,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ShippingError(
        "PROVIDER_UNAVAILABLE",
        "Não foi possível contatar o Melhor Envio.",
        { cause: error },
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new ShippingError(
        "PROVIDER_AUTH",
        "Falha de autenticação com o Melhor Envio.",
      );
    }

    if (!response.ok) {
      throw new ShippingError(
        "PROVIDER_UNAVAILABLE",
        `O Melhor Envio respondeu com status ${response.status}.`,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ShippingError(
        "INVALID_RESPONSE",
        "Resposta inesperada do Melhor Envio.",
        { cause: error },
      );
    }
  }
}
