import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { handlePaymentWebhook } from "@/modules/payments/payment.service";
import type { WebhookPayload } from "@/modules/payments/types";

export const dynamic = "force-dynamic";

/**
 * Webhook genérico de pagamentos. O provedor concreto é escolhido pelo path,
 * de modo que adicionar um novo provider não exige mudar esta rota.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const payload = body as Partial<WebhookPayload>;

  try {
    const result = await handlePaymentWebhook(provider, {
      provider,
      event: payload.event ?? "unknown",
      externalEventId: payload.externalEventId,
      providerPaymentId: payload.providerPaymentId,
      orderId: payload.orderId,
      status: payload.status,
      raw: body,
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error({
      event: "WEBHOOK_PROCESSING_FAILED",
      provider,
      externalEventId: payload.externalEventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro no webhook.",
      },
      { status: 400 },
    );
  }
}
