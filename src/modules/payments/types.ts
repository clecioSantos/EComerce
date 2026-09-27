/**
 * Abstração de provedor de pagamento.
 *
 * O domínio de pedidos conversa apenas com esta interface. Nenhuma integração
 * real (Mercado Pago, Stripe, PagBank...) é feita aqui: basta implementar
 * `PaymentProvider` e registrá-lo em `registry.ts`.
 */

export type PaymentIntentStatus =
  "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "REFUNDED" | "CANCELED";

export type PaymentMethodKind =
  "CREDIT_CARD" | "DEBIT_CARD" | "PIX" | "BOLETO" | "WALLET" | "OTHER";

export interface PayerIdentification {
  type: string;
  number: string;
}

export interface PayerDetails {
  email?: string;
  firstName?: string;
  lastName?: string;
  identification?: PayerIdentification;
}

/** Dados de cartão já tokenizados no browser (nunca trafegam PAN/CVV). */
export interface CardPaymentDetails {
  token: string;
  installments?: number;
  issuerId?: string;
  paymentMethodId?: string;
}

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
  /** Chave determinística para o `X-Idempotency-Key` do provedor. */
  idempotencyKey?: string | null;
  /** Dados tokenizados do cartão (obrigatórios para CREDIT_CARD/DEBIT_CARD). */
  card?: CardPaymentDetails;
  payer?: PayerDetails;
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
  /** Imagem do QR Code em base64 (sem prefixo data URI). */
  qrCodeBase64?: string;
  /** Página do Mercado Pago com o QR/instruções. */
  ticketUrl?: string;
  /** Detalhe bruto do status do provedor (ex.: `accredited`). */
  statusDetail?: string;
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
