import type {
  CreatePaymentInput,
  PaymentIntent,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookPayload,
  WebhookResult,
} from "../types";

/**
 * Provider de desenvolvimento: aprova pagamentos automaticamente e guarda o
 * estado em memória. Não faz nenhuma chamada externa.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";
  readonly name = "Mock Payment Provider";

  private readonly intents = new Map<string, PaymentIntent>();

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
    const providerPaymentId = `mock_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const intent: PaymentIntent = {
      providerPaymentId,
      status: "PAID",
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      checkoutUrl: `/checkout/sucesso?orderId=${input.orderId}`,
      qrCode:
        input.method === "PIX"
          ? `00020126MOCKPIX${providerPaymentId}5204000053039865802BR`
          : undefined,
      raw: { mock: true, orderId: input.orderId },
    };

    this.intents.set(providerPaymentId, intent);
    return intent;
  }

  async getPaymentStatus(
    providerPaymentId: string,
  ): Promise<PaymentIntent | null> {
    return this.intents.get(providerPaymentId) ?? null;
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const intent = this.intents.get(input.providerPaymentId);
    const amount = input.amount ?? intent?.amount ?? 0;

    if (intent) {
      intent.status = "REFUNDED";
      this.intents.set(input.providerPaymentId, intent);
    }

    return {
      providerTransactionId: `mock_refund_${Date.now()}`,
      status: "REFUNDED",
      amount,
    };
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    if (payload.providerPaymentId) {
      const intent = this.intents.get(payload.providerPaymentId);
      if (intent && payload.status) {
        intent.status = payload.status;
        this.intents.set(payload.providerPaymentId, intent);
      }
    }
    return {
      handled: true,
      orderId: payload.orderId,
      providerPaymentId: payload.providerPaymentId,
      status: payload.status,
    };
  }
}
