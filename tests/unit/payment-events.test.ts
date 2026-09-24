import { describe, expect, it } from "vitest";

import { resolveExternalEventId } from "@/modules/payments/events";

describe("resolveExternalEventId", () => {
  it("usa o externalEventId quando fornecido", () => {
    expect(
      resolveExternalEventId({
        provider: "mock",
        event: "payment.updated",
        externalEventId: "evt_123",
        raw: {},
      }),
    ).toBe("evt_123");
  });

  it("deriva um id determinístico quando ausente", () => {
    const first = resolveExternalEventId({
      provider: "mock",
      event: "payment.updated",
      providerPaymentId: "pay_1",
      status: "PAID",
      orderId: "ord_1",
      raw: {},
    });
    const second = resolveExternalEventId({
      provider: "mock",
      event: "payment.updated",
      providerPaymentId: "pay_1",
      status: "PAID",
      orderId: "ord_1",
      raw: {},
    });
    expect(first).toBe(second);
    expect(first).toContain("payment.updated");
  });

  it("gera ids diferentes para pagamentos diferentes", () => {
    const a = resolveExternalEventId({
      provider: "mock",
      event: "payment.updated",
      providerPaymentId: "pay_1",
      status: "PAID",
      raw: {},
    });
    const b = resolveExternalEventId({
      provider: "mock",
      event: "payment.updated",
      providerPaymentId: "pay_2",
      status: "PAID",
      raw: {},
    });
    expect(a).not.toBe(b);
  });
});
