import { describe, expect, it } from "vitest";

import { pickupShippingOption } from "@/modules/shipping/providers/pickup.provider";
import {
  MELHOR_ENVIO_FALLBACK_SERVICES,
  mergeServiceOptions,
  mergeShippingOptions,
} from "@/modules/shipping/services";
import type { ShippingOption } from "@/modules/shipping/types";

const services = [
  { id: "1", name: "PAC", companyName: "Correios" },
  { id: "2", name: "SEDEX", companyName: "Correios" },
];

describe("mergeServiceOptions", () => {
  it("mantém a lista quando não há ids salvos", () => {
    expect(mergeServiceOptions(services, [])).toEqual(services);
  });

  it("adiciona ids salvos que não vieram na lista", () => {
    const merged = mergeServiceOptions(services, ["1", "99"]);
    expect(merged.map((service) => service.id)).toEqual(["1", "2", "99"]);
    expect(merged.find((service) => service.id === "99")?.name).toContain("99");
  });

  it("não duplica ids já listados", () => {
    expect(mergeServiceOptions(services, ["1"])).toHaveLength(2);
  });
});

describe("MELHOR_ENVIO_FALLBACK_SERVICES", () => {
  it("inclui serviços comuns (PAC e SEDEX)", () => {
    const names = MELHOR_ENVIO_FALLBACK_SERVICES.map((service) => service.name);
    expect(names).toContain("PAC");
    expect(names).toContain("SEDEX");
  });
});

describe("pickupShippingOption", () => {
  it("é grátis e do provider pickup", () => {
    const option = pickupShippingOption();
    expect(option.provider).toBe("pickup");
    expect(option.price).toBe(0);
    expect(option.label).toMatch(/retirar/i);
  });
});

describe("mergeShippingOptions", () => {
  const quotes: ShippingOption[] = [
    { id: "melhor-envio:1", provider: "melhor-envio", label: "PAC", price: 20 },
    { id: "melhor-envio:2", provider: "melhor-envio", label: "SEDEX", price: 30 },
  ];

  it("adiciona a retirada na loja ao final", () => {
    const merged = mergeShippingOptions(quotes, [pickupShippingOption()]);
    expect(merged.map((option) => option.id)).toEqual([
      "melhor-envio:1",
      "melhor-envio:2",
      "pickup-store",
    ]);
  });

  it("não duplica quando a retirada já está presente", () => {
    const merged = mergeShippingOptions(
      [pickupShippingOption()],
      [pickupShippingOption()],
    );
    expect(merged).toHaveLength(1);
  });
});
