import type { PaymentStatus } from "@/generated/prisma/enums";

import type { PaymentIntentStatus } from "../../types";

/**
 * Mapeia o status bruto do Mercado Pago para o domínio interno.
 *
 * Observações de modelagem (fonte única de verdade):
 * - `in_process` e `authorized` permanecem pendentes de captura/confirmação.
 * - `expired` NÃO existe no enum PaymentStatus do projeto; mapeamos para
 *   `CANCELED` (o `OrderStatus.EXPIRED` é tratado pela rotina de expiração).
 * - `charged_back` (estorno/chargeback) é tratado como `REFUNDED`.
 */
const STATUS_MAP: Record<string, PaymentStatus> = {
  approved: "PAID",
  authorized: "AUTHORIZED",
  pending: "PENDING",
  in_process: "PENDING",
  in_mediation: "PENDING",
  rejected: "FAILED",
  cancelled: "CANCELED",
  canceled: "CANCELED",
  refunded: "REFUNDED",
  charged_back: "REFUNDED",
  expired: "CANCELED",
};

export function mapMercadoPagoStatus(status: string | null | undefined): PaymentStatus {
  if (!status) return "PENDING";
  return STATUS_MAP[status.toLowerCase()] ?? "PENDING";
}

/** Estados terminais não devem gerar novas transições de captura. */
export function isFinalMercadoPagoStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return [
    "approved",
    "rejected",
    "cancelled",
    "canceled",
    "refunded",
    "charged_back",
  ].includes(status.toLowerCase());
}

export type { PaymentIntentStatus };
