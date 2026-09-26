import { describe, expect, it, vi } from "vitest";

import { MissingShippingDataError, ShippingError } from "@/modules/shipping/errors";
import {
  normalizeMelhorEnvioQuotes,
  normalizeMelhorEnvioServices,
  parseMoney,
} from "@/modules/shipping/melhor-envio/normalize";
import { MelhorEnvioShippingProvider } from "@/modules/shipping/melhor-envio/provider-core";
import {
  buildMelhorEnvioRequest,
  buildUserAgent,
  collectMissingLogistics,
  toMelhorEnvioProducts,
} from "@/modules/shipping/melhor-envio/request";
import type {
  MelhorEnvioCalculateRequest,
  MelhorEnvioCalculator,
  MelhorEnvioQuote,
} from "@/modules/shipping/melhor-envio/types";
import type { ShippingItem } from "@/modules/shipping/types";

const validItem: ShippingItem = {
  variantId: "v1",
  sku: "SKU-1",
  quantity: 2,
  weight: 0.3,
  width: 11,
  height: 17,
  length: 11,
  unitPrice: 10.129,
};

describe("buildUserAgent", () => {
  it("inclui o e-mail de contato quando informado", () => {
    expect(buildUserAgent("Loja", "suporte@loja.com")).toBe("Loja (suporte@loja.com)");
  });

  it("usa apenas o nome quando não há e-mail", () => {
    expect(buildUserAgent("Loja", null)).toBe("Loja");
  });
});

describe("collectMissingLogistics", () => {
  it("não acusa itens completos", () => {
    expect(collectMissingLogistics([validItem])).toHaveLength(0);
  });

  it("lista os campos ausentes/inválidos por variante", () => {
    const missing = collectMissingLogistics([{ ...validItem, weight: 0, width: null }]);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      variantId: "v1",
      sku: "SKU-1",
      missing: ["weight", "width"],
    });
  });
});

describe("toMelhorEnvioProducts", () => {
  it("mapeia itens e arredonda o valor segurado", () => {
    const products = toMelhorEnvioProducts([validItem]);
    expect(products[0]).toEqual({
      id: "SKU-1",
      width: 11,
      height: 17,
      length: 11,
      weight: 0.3,
      insurance_value: 10.13,
      quantity: 2,
    });
  });

  it("usa o variantId quando não há SKU", () => {
    const products = toMelhorEnvioProducts([{ ...validItem, sku: undefined }]);
    expect(products[0].id).toBe("v1");
  });
});

describe("buildMelhorEnvioRequest", () => {
  it("monta from/to, products e services", () => {
    const request = buildMelhorEnvioRequest({
      originPostalCode: "96020360",
      destinationPostalCode: "01018020",
      items: [validItem],
      services: ["1", "2"],
    });
    expect(request.from).toEqual({ postal_code: "96020360" });
    expect(request.to).toEqual({ postal_code: "01018020" });
    expect(request.services).toBe("1,2");
    expect(request.products).toHaveLength(1);
    expect(request.options).toEqual({ receipt: false, own_hand: false });
  });
});

describe("parseMoney", () => {
  it("converte string, número e vírgula decimal", () => {
    expect(parseMoney("37.79")).toBe(37.79);
    expect(parseMoney(10)).toBe(10);
    expect(parseMoney("10,50")).toBe(10.5);
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("normalizeMelhorEnvioQuotes", () => {
  const raw: MelhorEnvioQuote[] = [
    {
      id: 1,
      name: "PAC",
      price: "37.79",
      custom_price: "30.00",
      delivery_time: 9,
      delivery_range: { min: 8, max: 9 },
      custom_delivery_time: 5,
      custom_delivery_range: { min: 4, max: 5 },
      company: { name: "Correios" },
    },
    {
      id: 2,
      name: "SEDEX",
      price: "46.23",
      delivery_time: 4,
      delivery_range: { min: 3, max: 4 },
      company: { name: "Correios" },
    },
    { id: 3, name: "Indisponível", error: "serviço indisponível", price: "10" },
    { id: 4, name: "Sem preço" },
  ];

  it("prefere custom_price e custom_delivery_range", () => {
    const options = normalizeMelhorEnvioQuotes(raw, "melhor-envio");
    expect(options).toHaveLength(2);

    const pac = options[0];
    expect(pac).toMatchObject({
      id: "melhor-envio:1",
      provider: "melhor-envio",
      label: "PAC",
      companyName: "Correios",
      price: 30,
      estimatedDaysMin: 4,
      estimatedDaysMax: 5,
    });
  });

  it("cai para price/delivery_range quando não há customização", () => {
    const options = normalizeMelhorEnvioQuotes(raw, "melhor-envio");
    expect(options[1]).toMatchObject({
      id: "melhor-envio:2",
      price: 46.23,
      estimatedDaysMin: 3,
      estimatedDaysMax: 4,
    });
  });

  it("descarta serviços com erro ou sem preço", () => {
    const options = normalizeMelhorEnvioQuotes(raw, "melhor-envio");
    expect(options.map((option) => option.id)).toEqual([
      "melhor-envio:1",
      "melhor-envio:2",
    ]);
  });

  it("retorna vazio para resposta inesperada", () => {
    expect(normalizeMelhorEnvioQuotes({ message: "erro" }, "melhor-envio")).toEqual([]);
  });
});

describe("normalizeMelhorEnvioServices", () => {
  it("mapeia id, nome e transportadora", () => {
    const services = normalizeMelhorEnvioServices([
      { id: 1, name: "PAC", company: { name: "Correios" } },
      { id: "2", name: "SEDEX", company: { name: "Correios" } },
    ]);
    expect(services).toEqual([
      { id: "1", name: "PAC", companyName: "Correios" },
      { id: "2", name: "SEDEX", companyName: "Correios" },
    ]);
  });

  it("descarta entradas inválidas ou sem nome", () => {
    const services = normalizeMelhorEnvioServices([
      null,
      { name: "sem id" },
      { id: 9, name: "   " },
      { id: 3, name: ".Package" },
    ]);
    expect(services).toEqual([{ id: "3", name: ".Package", companyName: undefined }]);
  });

  it("retorna vazio para resposta inesperada", () => {
    expect(normalizeMelhorEnvioServices({ message: "erro" })).toEqual([]);
  });
});

describe("MelhorEnvioShippingProvider", () => {
  function createProvider(quotes: MelhorEnvioQuote[] = []) {
    const calculate = vi.fn(async (request: MelhorEnvioCalculateRequest) => {
      void request;
      return quotes;
    });
    const calculator: MelhorEnvioCalculator = { calculate };
    const provider = new MelhorEnvioShippingProvider(calculator, ["1", "2"]);
    return { provider, calculate };
  }

  const validInput = {
    origin: { postalCode: "96020360" },
    address: { postalCode: "01018-020" },
    items: [validItem],
    subtotal: 100,
  };

  it("monta a requisição corretamente e normaliza a resposta", async () => {
    const { provider, calculate } = createProvider([
      {
        id: 1,
        name: "PAC",
        custom_price: "20.00",
        custom_delivery_time: 6,
        custom_delivery_range: { min: 5, max: 6 },
        company: { name: "Correios" },
      },
    ]);

    const options = await provider.quote(validInput);

    expect(calculate).toHaveBeenCalledTimes(1);
    expect(calculate.mock.calls[0][0]).toMatchObject({
      from: { postal_code: "96020360" },
      to: { postal_code: "01018020" },
      services: "1,2",
    });
    expect(options[0]).toMatchObject({ id: "melhor-envio:1", price: 20 });
  });

  it("exige origem configurada", async () => {
    const { provider } = createProvider();
    await expect(provider.quote({ ...validInput, origin: null })).rejects.toMatchObject({
      code: "ORIGIN_NOT_CONFIGURED",
    });
  });

  it("rejeita CEP de destino inválido", async () => {
    const { provider } = createProvider();
    await expect(
      provider.quote({ ...validInput, address: { postalCode: "123" } }),
    ).rejects.toMatchObject({ code: "INVALID_POSTAL_CODE" });
  });

  it("lança MissingShippingDataError para variante sem dados logísticos", async () => {
    const { provider } = createProvider();
    const error = await provider
      .quote({ ...validInput, items: [{ ...validItem, height: null }] })
      .catch((err) => err);
    expect(error).toBeInstanceOf(MissingShippingDataError);
    expect((error as MissingShippingDataError).variants[0].missing).toContain("height");
  });

  it("exige ao menos um serviço habilitado", async () => {
    const calculate = vi.fn(async () => [] as MelhorEnvioQuote[]);
    const provider = new MelhorEnvioShippingProvider({ calculate }, []);
    await expect(provider.quote(validInput)).rejects.toMatchObject({
      code: "NO_SERVICES",
    });
  });

  it("propaga erro de autenticação do provedor", async () => {
    const calculate = vi.fn(async () => {
      throw new ShippingError("PROVIDER_AUTH", "sem token");
    });
    const provider = new MelhorEnvioShippingProvider({ calculate }, ["1"]);
    await expect(provider.quote(validInput)).rejects.toMatchObject({
      code: "PROVIDER_AUTH",
    });
  });
});
