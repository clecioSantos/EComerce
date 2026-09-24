import "server-only";

import pino from "pino";

/**
 * Logger estruturado (JSON). Em produção os logs são consumidos por
 * agregadores (Datadog/Loki/ELK); em dev saem como JSON em stdout.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "ecommerce-core", env: process.env.NODE_ENV ?? "development" },
});

/** Eventos de negócio rastreáveis (usados para reconstruir uma operação). */
export type BusinessEvent =
  | "CHECKOUT_STARTED"
  | "ORDER_CREATED"
  | "ORDER_CANCELLED"
  | "ORDER_EXPIRED"
  | "STOCK_RESERVED"
  | "STOCK_RELEASED"
  | "STOCK_CONSUMED"
  | "STOCK_RESTOCKED"
  | "PAYMENT_CREATED"
  | "PAYMENT_APPROVED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "WEBHOOK_RECEIVED"
  | "WEBHOOK_DUPLICATE"
  | "WEBHOOK_REJECTED";

export interface EventFields {
  requestId?: string;
  userId?: string | null;
  orderId?: string;
  paymentId?: string;
  variantId?: string;
  provider?: string;
  externalEventId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export function logEvent(event: BusinessEvent, fields: EventFields = {}): void {
  // `event` sempre vence: evita que campos do payload sobrescrevam o nome do
  // evento de negócio.
  logger.info({ ...fields, event });
}
