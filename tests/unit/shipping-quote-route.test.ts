import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/dal", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/cart/cart.service", () => ({ getActiveCart: vi.fn() }));
vi.mock("@/modules/shipping/quote.service", () => ({
  buildShippingItems: vi.fn(),
  sumShippingItemsSubtotal: vi.fn(),
  quoteShippingForItems: vi.fn(),
}));

import { POST } from "@/app/api/shipping/quote/route";
import { getSession } from "@/lib/auth/dal";
import { getActiveCart } from "@/modules/cart/cart.service";
import { MissingShippingDataError, ShippingError } from "@/modules/shipping/errors";
import {
  buildShippingItems,
  quoteShippingForItems,
  sumShippingItemsSubtotal,
} from "@/modules/shipping/quote.service";
import type { ShippingOption } from "@/modules/shipping/types";

const getSessionMock = vi.mocked(getSession);
const getActiveCartMock = vi.mocked(getActiveCart);
const buildItemsMock = vi.mocked(buildShippingItems);
const sumMock = vi.mocked(sumShippingItemsSubtotal);
const quoteMock = vi.mocked(quoteShippingForItems);

const option: ShippingOption = {
  id: "melhor-envio:1",
  provider: "melhor-envio",
  label: "PAC",
  companyName: "Correios",
  price: 20,
  estimatedDaysMin: 5,
  estimatedDaysMax: 6,
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/shipping/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue(undefined as never);
  getActiveCartMock.mockResolvedValue({
    items: [{ variantId: "v1", product: { name: "Produto" } }],
  } as never);
  buildItemsMock.mockReturnValue([{ variantId: "v1", quantity: 1 }] as never);
  sumMock.mockReturnValue(100);
  quoteMock.mockResolvedValue([option]);
});

describe("POST /api/shipping/quote", () => {
  it("retorna as opções para um CEP válido", async () => {
    const response = await POST(makeRequest({ postalCode: "01018-020" }) as never);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.postalCode).toBe("01018020");
    expect(body.options).toHaveLength(1);
    expect(quoteMock).toHaveBeenCalledWith(
      expect.objectContaining({ destinationPostalCode: "01018020" }),
    );
  });

  it("rejeita CEP inválido sem consultar o frete", async () => {
    const response = await POST(makeRequest({ postalCode: "123" }) as never);
    expect(response.status).toBe(400);
    expect(quoteMock).not.toHaveBeenCalled();
  });

  it("retorna EMPTY_CART quando não há carrinho", async () => {
    getActiveCartMock.mockResolvedValue(null as never);
    const response = await POST(makeRequest({ postalCode: "01018020" }) as never);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("EMPTY_CART");
  });

  it("retorna MISSING_LOGISTICS (422) para variante incompleta", async () => {
    quoteMock.mockRejectedValue(
      new MissingShippingDataError([
        { variantId: "v1", sku: "SKU-1", missing: ["weight"] },
      ]),
    );
    const response = await POST(makeRequest({ postalCode: "01018020" }) as never);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("MISSING_LOGISTICS");
    expect(body.error).not.toContain("SKU-1");
  });

  it("retorna 503 quando a origem da loja não está configurada", async () => {
    quoteMock.mockRejectedValue(new ShippingError("ORIGIN_NOT_CONFIGURED", "sem origem"));
    const response = await POST(makeRequest({ postalCode: "01018020" }) as never);
    expect(response.status).toBe(503);
  });

  it("retorna 502 quando o Melhor Envio está indisponível", async () => {
    quoteMock.mockRejectedValue(new ShippingError("PROVIDER_UNAVAILABLE", "timeout"));
    const response = await POST(makeRequest({ postalCode: "01018020" }) as never);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/token/i);
  });
});
