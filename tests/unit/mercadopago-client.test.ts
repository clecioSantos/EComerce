import { describe, expect, it, vi } from "vitest";

import {
  MercadoPagoClient,
  requestOAuthToken,
} from "@/modules/payments/providers/mercadopago/client";
import { MercadoPagoError } from "@/modules/payments/providers/mercadopago/errors";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("MercadoPagoClient", () => {
  it("envia Authorization e X-Idempotency-Key", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 1, status: "pending" }));
    const client = new MercadoPagoClient({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.createPayment({ transaction_amount: 10 }, "idem-1");

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/v1/payments");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("idem-1");
  });

  it("normaliza 401 como unauthorized", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: "unauth" }, 401));
    const client = new MercadoPagoClient({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.getPayment("1")).rejects.toMatchObject({
      kind: "unauthorized",
      status: 401,
    });
  });

  it("normaliza 422 como validation e preserva o código", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ cause: [{ code: "card_token", description: "invalid" }] }, 422),
      );
    const client = new MercadoPagoClient({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.createPayment({})).rejects.toMatchObject({
      kind: "validation",
      status: 422,
      code: "card_token",
    });
  });

  it("normaliza timeout via AbortController", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    const client = new MercadoPagoClient({
      accessToken: "tok",
      timeoutMs: 10,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.getPayment("1")).rejects.toMatchObject({ kind: "timeout" });
  });

  it("lança unauthorized quando não há token", async () => {
    const client = new MercadoPagoClient({
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    await expect(client.getPayment("1")).rejects.toBeInstanceOf(MercadoPagoError);
  });

  it("requestOAuthToken não envia Authorization", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: "a" }));
    await requestOAuthToken(
      { grant_type: "authorization_code" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
