import { NextResponse, type NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { handlePaymentWebhook } from "@/modules/payments/payment.service";
import { toHttpStatus } from "@/modules/payments/providers/mercadopago/errors";
import { verifyMercadoPagoSignature } from "@/modules/payments/providers/mercadopago/signature";

export const dynamic = "force-dynamic";

interface MercadoPagoNotification {
  id?: string | number;
  type?: string;
  topic?: string;
  action?: string;
  data?: { id?: string | number | null };
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const env = getEnv();

  let body: MercadoPagoNotification;
  try {
    body = (await request.json()) as MercadoPagoNotification;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const dataId = body.data?.id != null ? String(body.data.id) : null;
  const requestId = request.headers.get("x-request-id");
  const bypass = env.MERCADOPAGO_WEBHOOK_DEBUG_BYPASS && env.NODE_ENV !== "production";

  if (!bypass) {
    const verification = verifyMercadoPagoSignature({
      signatureHeader: request.headers.get("x-signature"),
      requestId,
      dataId,
      secret: env.MERCADOPAGO_WEBHOOK_SECRET,
    });
    if (!verification.valid) {
      logger.warn({
        event: "PAYMENT_WEBHOOK_UNAUTHORIZED",
        provider: "mercadopago",
        reason: verification.reason,
        requestId,
      });
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
  }

  if (!dataId) {
    // Notificação sem pagamento associado: confirma recebimento sem processar.
    logger.info({
      event: "PAYMENT_WEBHOOK_IGNORED",
      provider: "mercadopago",
      type: body.type ?? body.topic,
      requestId,
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const result = await handlePaymentWebhook("mercadopago", {
      provider: "mercadopago",
      event: body.type ?? body.topic ?? body.action ?? "payment.updated",
      externalEventId: body.id != null ? String(body.id) : undefined,
      providerPaymentId: dataId,
      raw: body,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = toHttpStatus(error);
    logger.error({
      event: "PAYMENT_WEBHOOK_FAILED",
      provider: "mercadopago",
      requestId,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Falha ao processar webhook." }, { status });
  }
}
