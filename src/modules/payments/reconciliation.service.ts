import "server-only";

import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-context";

import { applyPaymentStatus } from "./payment.service";
import { getPaymentProvider } from "./registry";

export interface ReconcileResult {
  scanned: number;
  updated: number;
  failed: number;
  details: { paymentId: string; providerPaymentId: string; status: string }[];
}

/**
 * Reconciliação: busca pagamentos pendentes recentes e consulta o estado real
 * no Mercado Pago. Corrige casos de webhook perdido/indisponibilidade.
 *
 * Nunca marca um pagamento como pago se a consulta falhar: em erro, mantém
 * PENDING e incrementa `failed` para nova tentativa no próximo ciclo.
 */
export async function reconcileMercadoPagoPayments(
  params: { withinHours?: number; limit?: number } = {},
): Promise<ReconcileResult> {
  const withinHours = params.withinHours ?? 48;
  const limit = params.limit ?? 50;
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const requestId = await getRequestId();

  const pending = await prisma.payment.findMany({
    where: {
      provider: "mercadopago",
      status: { in: ["PENDING", "AUTHORIZED"] },
      providerPaymentId: { not: null },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const provider = getPaymentProvider("mercadopago");
  const result: ReconcileResult = {
    scanned: pending.length,
    updated: 0,
    failed: 0,
    details: [],
  };

  for (const payment of pending) {
    const providerPaymentId = payment.providerPaymentId;
    if (!providerPaymentId) continue;

    try {
      const intent = await provider.getPaymentStatus(providerPaymentId);
      if (!intent || intent.status === payment.status) continue;

      const applied = await applyPaymentStatus({
        providerId: "mercadopago",
        providerPaymentId,
        status: intent.status,
        // Id determinístico por (pagamento, status): dedupe entre execuções.
        externalEventId: `reconcile:${providerPaymentId}:${intent.status}`,
        eventType: "reconciliation",
        source: "reconciliation",
      });

      if (applied.handled && !applied.duplicate && !applied.rejected) {
        result.updated += 1;
        result.details.push({
          paymentId: payment.id,
          providerPaymentId,
          status: intent.status,
        });
      }
    } catch (error) {
      result.failed += 1;
      logEvent("PAYMENT_RECONCILIATION", {
        requestId,
        provider: "mercadopago",
        paymentId: payment.id,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logEvent("PAYMENT_RECONCILIATION", {
    requestId,
    provider: "mercadopago",
    scanned: result.scanned,
    updated: result.updated,
    failed: result.failed,
  });

  return result;
}
