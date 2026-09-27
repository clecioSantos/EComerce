import { MercadoPagoError } from "./errors";
import type {
  MercadoPagoOAuthTokenResponse,
  MercadoPagoPayment,
  MercadoPagoRefundResponse,
  MercadoPagoUser,
} from "./types";

export interface MercadoPagoClientOptions {
  accessToken?: string;
  apiUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  idempotencyKey?: string | null;
  accessToken?: string;
}

const DEFAULT_API_URL = "https://api.mercadopago.com";
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Cliente HTTP do Mercado Pago. Concentra timeout, headers, idempotência e
 * normalização de erros. Nunca loga nem propaga tokens.
 */
export class MercadoPagoClient {
  private readonly accessToken?: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MercadoPagoClientOptions = {}) {
    this.accessToken = options.accessToken;
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = options.accessToken ?? this.accessToken;
    if (options.auth !== false && !token) {
      throw new MercadoPagoError({
        kind: "unauthorized",
        message: "Mercado Pago sem access token configurado.",
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          ...(options.auth === false ? {} : { Authorization: `Bearer ${token}` }),
          "Content-Type": "application/json",
          ...(options.idempotencyKey
            ? { "X-Idempotency-Key": options.idempotencyKey }
            : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new MercadoPagoError({
        kind: aborted ? "timeout" : "network",
        message: aborted
          ? "Tempo esgotado ao chamar o Mercado Pago."
          : "Falha de rede ao chamar o Mercado Pago.",
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    const parsed = text ? safeJson(text) : undefined;

    if (!response.ok) {
      throw new MercadoPagoError({
        kind: response.status === 401 ? "unauthorized" : statusKind(response.status),
        status: response.status,
        code: extractCode(parsed),
        message: extractMessage(parsed) ?? `Mercado Pago respondeu ${response.status}.`,
        details: parsed,
      });
    }

    return parsed as T;
  }

  createPayment(payload: Record<string, unknown>, idempotencyKey?: string | null) {
    return this.request<MercadoPagoPayment>("/v1/payments", {
      method: "POST",
      body: payload,
      idempotencyKey,
    });
  }

  getPayment(providerPaymentId: string) {
    return this.request<MercadoPagoPayment>(
      `/v1/payments/${encodeURIComponent(providerPaymentId)}`,
    );
  }

  refund(providerPaymentId: string, amount?: number, idempotencyKey?: string) {
    return this.request<MercadoPagoRefundResponse>(
      `/v1/payments/${encodeURIComponent(providerPaymentId)}/refunds`,
      {
        method: "POST",
        body: amount != null ? { amount: Number(amount.toFixed(2)) } : {},
        idempotencyKey,
      },
    );
  }

  getMe(accessToken: string) {
    return this.request<MercadoPagoUser>("/users/me", { accessToken });
  }
}

/** Troca/renova tokens OAuth (endpoint público, sem Bearer). */
export async function requestOAuthToken(
  body: Record<string, unknown>,
  options: MercadoPagoClientOptions = {},
): Promise<MercadoPagoOAuthTokenResponse> {
  const client = new MercadoPagoClient(options);
  return client["request"]("/oauth/token", { method: "POST", body, auth: false });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const record = parsed as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  if (Array.isArray(record.cause) && record.cause[0]) {
    const first = record.cause[0] as Record<string, unknown>;
    if (typeof first.description === "string") return first.description;
    if (typeof first.code === "string") return first.code;
  }
  return undefined;
}

function extractCode(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const record = parsed as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (Array.isArray(record.cause) && record.cause[0]) {
    const first = record.cause[0] as Record<string, unknown>;
    if (typeof first.code === "string") return first.code;
  }
  return undefined;
}

function statusKind(status: number): "validation" | "api" {
  return status === 400 || status === 422 ? "validation" : "api";
}
