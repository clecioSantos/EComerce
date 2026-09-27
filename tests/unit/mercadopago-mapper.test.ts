import { describe, expect, it } from "vitest";

import {
  buildPaymentPayload,
  inferPaymentMethod,
  normalizePayerEmail,
  redactPaymentPayload,
  resolvePaymentMethodId,
  splitName,
  toPaymentIntent,
} from "@/modules/payments/providers/mercadopago/mapper";
import type { MercadoPagoPayment } from "@/modules/payments/providers/mercadopago/types";

const baseInput = {
  orderId: "order_123",
  amount: 199.9,
  currency: "BRL",
  customer: { name: "Maria Souza", email: "maria@example.com" },
  idempotencyKey: "key-1",
};

describe("splitName", () => {
  it("separa primeiro nome e sobrenome", () => {
    expect(splitName("Maria Souza")).toEqual({ firstName: "Maria", lastName: "Souza" });
    expect(splitName("Madonna")).toEqual({ firstName: "Madonna", lastName: "" });
    expect(splitName("  ")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("normalizePayerEmail", () => {
  it("normaliza para minúsculas e remove espaços", () => {
    expect(normalizePayerEmail("  Maria@Exemplo.COM ")).toBe("maria@exemplo.com");
  });

  it("rejeita e-mail sem TLD (que o MP recusa)", () => {
    expect(() => normalizePayerEmail("nome@dominio")).toThrow(/valid email/);
    expect(() => normalizePayerEmail("sem-arroba")).toThrow(/valid email/);
    expect(() => normalizePayerEmail("")).toThrow(/valid email/);
  });
});

describe("resolvePaymentMethodId", () => {
  it("usa pix para PIX", () => {
    expect(resolvePaymentMethodId({ ...baseInput, method: "PIX" })).toBe("pix");
  });

  it("usa o payment_method_id tokenizado quando presente", () => {
    expect(
      resolvePaymentMethodId({
        ...baseInput,
        method: "CREDIT_CARD",
        card: { token: "tok", paymentMethodId: "master" },
      }),
    ).toBe("master");
  });

  it("cai no default por método e rejeita métodos não suportados", () => {
    expect(
      resolvePaymentMethodId({
        ...baseInput,
        method: "CREDIT_CARD",
        card: { token: "t" },
      }),
    ).toBe("credit_card");
    expect(() => resolvePaymentMethodId({ ...baseInput, method: "WALLET" })).toThrow();
  });
});

describe("buildPaymentPayload", () => {
  it("monta payload PIX com external_reference e notification_url", () => {
    const payload = buildPaymentPayload(
      { ...baseInput, method: "PIX" },
      "https://loja.test/api/webhooks/mercadopago",
    );
    expect(payload).toMatchObject({
      transaction_amount: 199.9,
      payment_method_id: "pix",
      external_reference: "order_123",
      notification_url: "https://loja.test/api/webhooks/mercadopago",
    });
    expect(payload.payer).toMatchObject({ email: "maria@example.com" });
    expect(payload.token).toBeUndefined();
  });

  it("monta payload de cartão com token e parcelas", () => {
    const payload = buildPaymentPayload({
      ...baseInput,
      method: "CREDIT_CARD",
      card: { token: "card-token", installments: 3, issuerId: "123" },
    });
    expect(payload).toMatchObject({
      token: "card-token",
      installments: 3,
      issuer_id: "123",
      payment_method_id: "credit_card",
    });
  });

  it("exige token para cartão", () => {
    expect(() => buildPaymentPayload({ ...baseInput, method: "CREDIT_CARD" })).toThrow();
  });
});

describe("toPaymentIntent", () => {
  const payment: MercadoPagoPayment = {
    id: 987,
    status: "approved",
    status_detail: "accredited",
    payment_method_id: "pix",
    transaction_amount: 199.9,
    currency_id: "BRL",
    date_of_expiration: "2026-01-01T00:30:00.000-03:00",
    point_of_interaction: {
      transaction_data: {
        qr_code: "00020126...",
        qr_code_base64: "base64...",
        ticket_url: "https://mp/checkout",
      },
    },
  };

  it("extrai id, status e dados do PIX", () => {
    const intent = toPaymentIntent(payment);
    expect(intent).toMatchObject({
      providerPaymentId: "987",
      status: "PAID",
      method: "PIX",
      qrCode: "00020126...",
      qrCodeBase64: "base64...",
      ticketUrl: "https://mp/checkout",
      statusDetail: "accredited",
      expiresAt: "2026-01-01T00:30:00.000-03:00",
    });
  });
});

describe("redactPaymentPayload", () => {
  it("redige token, CPF e e-mail sem alterar o restante", () => {
    const redacted = redactPaymentPayload({
      transaction_amount: 199.9,
      token: "card-token-secret",
      payer: {
        email: "maria@exemplo.com",
        first_name: "Maria",
        identification: { type: "CPF", number: "12345678901" },
      },
    });

    expect(redacted.transaction_amount).toBe(199.9);
    expect(redacted.token).toBe("***token***");
    const payer = redacted.payer as Record<string, unknown>;
    expect(payer.email).toBe("ma***@exemplo.com");
    expect(payer.first_name).toBe("Maria");
    expect((payer.identification as Record<string, unknown>).number).toBe("***01");
  });
});

describe("inferPaymentMethod", () => {
  it("infere pelo payment_method_id", () => {
    expect(
      inferPaymentMethod({ id: 1, status: "approved", payment_method_id: "pix" }),
    ).toBe("PIX");
    expect(
      inferPaymentMethod({ id: 1, status: "approved", payment_method_id: "debvisa" }),
    ).toBe("DEBIT_CARD");
    expect(
      inferPaymentMethod({ id: 1, status: "approved", payment_method_id: "visa" }),
    ).toBe("OTHER");
  });
});
