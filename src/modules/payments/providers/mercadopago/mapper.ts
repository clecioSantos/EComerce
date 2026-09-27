import type { CreatePaymentInput, PaymentIntent, PaymentMethodKind } from "../../types";
import { MercadoPagoError } from "./errors";
import { mapMercadoPagoStatus } from "./status";
import type { MercadoPagoPayment } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const [first, ...rest] = trimmed.split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

/** Normaliza e valida o e-mail do pagador (o MP exige domínio com TLD). */
export function normalizePayerEmail(value: string | null | undefined): string {
  const email = (value ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new MercadoPagoError({
      kind: "validation",
      code: "invalid_payer_email",
      message: "payer.email must be a valid email",
    });
  }
  return email;
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
      email: normalizePayerEmail(input.payer?.email ?? input.customer.email),
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

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain || !user) return "***";
  const visible = user.slice(0, 2);
  return `${visible}***@${domain}`;
}

function maskDigits(value: string): string {
  const last = value.slice(-2);
  return `***${last}`;
}

/**
 * Redige o payload antes de logar: nunca expõe o token do cartão, o CPF nem o
 * e-mail completo do pagador. O restante permanece legível para depuração.
 */
export function redactPaymentPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const clone =
    typeof structuredClone === "function"
      ? structuredClone(payload)
      : (JSON.parse(JSON.stringify(payload)) as Record<string, unknown>);

  if (typeof clone.token === "string") clone.token = "***token***";

  const payer = clone.payer as Record<string, unknown> | undefined;
  if (payer) {
    if (typeof payer.email === "string") payer.email = maskEmail(payer.email);
    const identification = payer.identification as Record<string, unknown> | undefined;
    if (identification && typeof identification.number === "string") {
      identification.number = maskDigits(identification.number);
    }
  }

  return clone;
}
