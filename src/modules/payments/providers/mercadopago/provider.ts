import { getEnv } from "@/lib/env";

import type {
  CreatePaymentInput,
  PaymentIntent,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookPayload,
  WebhookResult,
} from "../../types";
import { getValidMercadoPagoAccessToken } from "../../oauth/account.service";
import { MercadoPagoClient } from "./client";
import { buildPaymentPayload, toPaymentIntent } from "./mapper";
import { mapMercadoPagoStatus } from "./status";

/**
 * Provider do Mercado Pago. Toda comunicação externa passa pelo
 * `MercadoPagoClient`; o domínio de pedidos só enxerga `PaymentProvider`.
 *
 * Regra: o webhook NÃO confia no payload — `handleWebhook` sempre consulta o
 * pagamento real no Mercado Pago antes de reportar um status.
 */
export class MercadoPagoProvider implements PaymentProvider {
  readonly id = "mercadopago";
  readonly name = "Mercado Pago";

  private createClient(accessToken: string): MercadoPagoClient {
    const env = getEnv();
    return new MercadoPagoClient({
      accessToken,
      apiUrl: env.MERCADOPAGO_API_URL,
      timeoutMs: env.MERCADOPAGO_TIMEOUT_MS,
    });
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
    const env = getEnv();
    const accessToken = await getValidMercadoPagoAccessToken();
    const notificationUrl = `${env.NEXT_PUBLIC_SITE_URL.replace(
      /\/$/,
      "",
    )}/api/webhooks/mercadopago`;

    const payload = buildPaymentPayload(input, notificationUrl);
    const payment = await this.createClient(accessToken).createPayment(
      payload,
      input.idempotencyKey ?? undefined,
    );

    return toPaymentIntent(payment, input.method);
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentIntent | null> {
    const accessToken = await getValidMercadoPagoAccessToken();
    try {
      const payment = await this.createClient(accessToken).getPayment(providerPaymentId);
      return toPaymentIntent(payment);
    } catch {
      return null;
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const accessToken = await getValidMercadoPagoAccessToken();
    const refund = await this.createClient(accessToken).refund(
      input.providerPaymentId,
      input.amount,
      input.providerPaymentId ? `refund:${input.providerPaymentId}` : undefined,
    );
    return {
      providerTransactionId: String(refund.id),
      status: "REFUNDED",
      amount: refund.amount ?? input.amount ?? 0,
    };
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    const providerPaymentId = payload.providerPaymentId;
    if (!providerPaymentId) {
      return { handled: false };
    }

    // Fonte de verdade é a consulta à API, nunca o corpo recebido.
    const intent = await this.getPaymentStatus(providerPaymentId);
    if (!intent) {
      return { handled: false, providerPaymentId };
    }

    return {
      handled: true,
      providerPaymentId: intent.providerPaymentId,
      status: intent.status,
    };
  }
}

export { mapMercadoPagoStatus };
