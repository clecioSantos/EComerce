/**
 * Abstração de provedor de pagamento.
 *
 * O domínio de pedidos conversa apenas com esta interface. Nenhuma integração
 * real (Mercado Pago, Stripe, PagBank...) é feita aqui: basta implementar
 * `PaymentProvider` e registrá-lo em `registry.ts`.
 */

export type PaymentIntentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELED";

export type PaymentMethodKind =
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "PIX"
  | "BOLETO"
  | "WALLET"
  | "OTHER";

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethodKind;
  customer: {
    name: string;
    email: string;
  };
  metadata?: Record<string, unknown>;
}

export interface PaymentIntent {
  providerPaymentId: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  method: PaymentMethodKind;
  /** URL para redirecionar o cliente (checkout hospedado). */
  checkoutUrl?: string;
  /** Código PIX copia-e-cola, quando aplicável. */
  qrCode?: string;
  expiresAt?: string;
  raw?: unknown;
}

export interface RefundInput {
  providerPaymentId: string;
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  providerTransactionId: string;
  status: PaymentIntentStatus;
  amount: number;
}

export interface WebhookPayload {
  provider: string;
  event: string;
  /** Identificador único do evento no provedor externo (se houver). */
  externalEventId?: string;
  providerPaymentId?: string;
  orderId?: string;
  status?: PaymentIntentStatus;
  raw: unknown;
}

export interface WebhookResult {
  handled: boolean;
  orderId?: string;
  providerPaymentId?: string;
  status?: PaymentIntentStatus;
}

export interface PaymentProvider {
  readonly id: string;
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentIntent>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentIntent | null>;
  refund(input: RefundInput): Promise<RefundResult>;
  handleWebhook(payload: WebhookPayload): Promise<WebhookResult>;
}
