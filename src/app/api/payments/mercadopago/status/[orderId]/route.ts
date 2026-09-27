import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { logger } from "@/lib/logger";
import { getOrderById } from "@/modules/orders/order.service";
import {
  applyPaymentStatus,
  getLatestPaymentIntent,
} from "@/modules/payments/payment.service";
import { getPaymentProvider } from "@/modules/payments/registry";

export const dynamic = "force-dynamic";

/**
 * Consulta o status do pagamento de um pedido. Como fallback (ex.: webhook não
 * configurado em desenvolvimento), consulta o Mercado Pago e reconcilia.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const session = await getSession();
  const order = await getOrderById(orderId);

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (order.userId && order.userId !== session?.user?.id) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  let latest = await getLatestPaymentIntent(orderId);

  const isPending =
    latest?.payment.status === "PENDING" || latest?.payment.status === "AUTHORIZED";
  if (
    latest?.payment.provider === "mercadopago" &&
    latest.payment.providerPaymentId &&
    isPending
  ) {
    try {
      const provider = getPaymentProvider("mercadopago");
      const intent = await provider.getPaymentStatus(latest.payment.providerPaymentId);
      if (intent && intent.status !== latest.payment.status) {
        await applyPaymentStatus({
          providerId: "mercadopago",
          providerPaymentId: latest.payment.providerPaymentId,
          status: intent.status,
          externalEventId: `poll:${latest.payment.providerPaymentId}:${intent.status}`,
          eventType: "poll",
          source: "sync",
        });
        latest = await getLatestPaymentIntent(orderId);
      }
    } catch (error) {
      logger.warn({
        event: "PAYMENT_STATUS_POLL_FAILED",
        provider: "mercadopago",
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    orderId,
    orderNumber: order.number,
    orderStatus: order.status,
    paymentStatus: latest?.payment.status ?? order.paymentStatus,
    status: latest?.intent.status ?? order.paymentStatus,
    qrCode: latest?.intent.qrCode ?? null,
    expiresAt: latest?.intent.expiresAt ?? null,
  });
}
