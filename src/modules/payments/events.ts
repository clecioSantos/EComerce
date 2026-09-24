import type { WebhookPayload } from "./types";

/**
 * Resolve um identificador determinístico para o evento externo. Se o provedor
 * envia um `externalEventId`, ele é usado; caso contrário, derivamos de campos
 * estáveis para que o mesmo evento físico gere sempre o mesmo id (idempotência).
 */
export function resolveExternalEventId(payload: WebhookPayload): string {
  const provided = payload.externalEventId?.trim();
  if (provided && provided.length > 0) return provided;

  return [
    payload.event || "unknown",
    payload.providerPaymentId ?? "no-payment",
    payload.status ?? "no-status",
    payload.orderId ?? "no-order",
  ].join(":");
}
