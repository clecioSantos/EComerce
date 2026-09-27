import type { CreatePaymentInput, PaymentIntent, PaymentMethodKind } from "../../types";
import { mapMercadoPagoStatus } from "./status";
import type { MercadoPagoPayment } from "./types";

export function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const [first, ...rest] = trimmed.split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

/** Define o `payment_method_id` conforme o método interno. */
export function resolvePaymentMethodId(input: CreatePaymentInput): string {
  if (input.method === "PIX") return "pix";
  if (input.card?.paymentMethodId) return input.card.paymentMethodId;
  if (input.method === "DEBIT_CARD") return "debit_card";
  if (input.method === "CREDIT_CARD") return "credit_card";
  throw new Error(`Método de pagamento não suportado: ${input.method}`);
}

export function buildPaymentPayload(
  input: CreatePaymentInput,
  notificationUrl?: string,
): Record<string, unknown> {
  const { firstName, lastName } = splitName(input.customer.name);
  const paymentMethodId = resolvePaymentMethodId(input);
  const isCard = input.method === "CREDIT_CARD" || input.method === "DEBIT_CARD";

  const payload: Record<string, unknown> = {
    transaction_amount: Number(input.amount.toFixed(2)),
    description: `Pedido ${input.orderId}`,
    payment_method_id: paymentMethodId,
    external_reference: input.orderId,
    payer: {
      email: input.payer?.email ?? input.customer.email,
      first_name: (input.payer?.firstName ?? firstName) || undefined,
      last_name: (input.payer?.lastName ?? lastName) || undefined,
      identification: input.payer?.identification,
    },
  };

  if (notificationUrl) payload.notification_url = notificationUrl;

  if (isCard) {
    if (!input.card?.token) {
      throw new Error("Token do cartão é obrigatório para pagamento com cartão.");
    }
    payload.token = input.card.token;
    payload.installments = input.card.installments ?? 1;
    if (input.card.issuerId) payload.issuer_id = input.card.issuerId;
  }

  return payload;
}

/** Infere o método interno a partir do `payment_method_id` do MP. */
export function inferPaymentMethod(payment: MercadoPagoPayment): PaymentMethodKind {
  const id = String(payment.payment_method_id ?? "").toLowerCase();
  if (id === "pix") return "PIX";
  if (id.startsWith("deb")) return "DEBIT_CARD";
  if (id.includes("credit")) return "CREDIT_CARD";
  if (id.includes("bolbradesco") || id.includes("boleto")) return "BOLETO";
  return "OTHER";
}

/** Converte a resposta do MP para o nosso `PaymentIntent`. */
export function toPaymentIntent(
  payment: MercadoPagoPayment,
  method?: PaymentMethodKind,
): PaymentIntent {
  const transactionData = payment.point_of_interaction?.transaction_data;
  return {
    providerPaymentId: String(payment.id),
    status: mapMercadoPagoStatus(payment.status),
    amount: Number(payment.transaction_amount ?? 0),
    currency: payment.currency_id ?? "BRL",
    method: method ?? inferPaymentMethod(payment),
    qrCode: transactionData?.qr_code ?? undefined,
    qrCodeBase64: transactionData?.qr_code_base64 ?? undefined,
    ticketUrl: transactionData?.ticket_url ?? undefined,
    statusDetail: payment.status_detail,
    expiresAt: payment.date_of_expiration ?? undefined,
    raw: payment,
  };
}
