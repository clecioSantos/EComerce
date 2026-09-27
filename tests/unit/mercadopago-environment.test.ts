import { describe, expect, it } from "vitest";

import {
  isMercadoPagoSandbox,
  publicKeyMatchesEnvironment,
  resolveMercadoPagoEnvironment,
  selectMercadoPagoPublicKey,
} from "@/modules/payments/providers/mercadopago/environment";

describe("resolveMercadoPagoEnvironment", () => {
  it("usa sandbox somente com 'sandbox'", () => {
    expect(resolveMercadoPagoEnvironment("sandbox")).toBe("sandbox");
    expect(resolveMercadoPagoEnvironment("production")).toBe("production");
    expect(resolveMercadoPagoEnvironment(undefined)).toBe("production");
    expect(resolveMercadoPagoEnvironment("outro")).toBe("production");
  });

  it("isMercadoPagoSandbox reflete o ambiente", () => {
    expect(isMercadoPagoSandbox("sandbox")).toBe(true);
    expect(isMercadoPagoSandbox("production")).toBe(false);
    expect(isMercadoPagoSandbox(null)).toBe(false);
  });
});

describe("publicKeyMatchesEnvironment", () => {
  it("sandbox exige chave TEST-", () => {
    expect(publicKeyMatchesEnvironment("TEST-abc", "sandbox")).toBe(true);
    expect(publicKeyMatchesEnvironment("APP_USR-abc", "sandbox")).toBe(false);
  });

  it("produção exige chave APP_USR-", () => {
    expect(publicKeyMatchesEnvironment("APP_USR-abc", "production")).toBe(true);
    expect(publicKeyMatchesEnvironment("TEST-abc", "production")).toBe(false);
  });

  it("chave ausente nunca corresponde", () => {
    expect(publicKeyMatchesEnvironment(null, "sandbox")).toBe(false);
    expect(publicKeyMatchesEnvironment("", "production")).toBe(false);
  });
});

describe("selectMercadoPagoPublicKey", () => {
  it("em sandbox prefere a chave de teste", () => {
    expect(
      selectMercadoPagoPublicKey({
        environment: "sandbox",
        productionPublicKey: "APP_USR-prod",
        sandboxPublicKey: "TEST-sandbox",
      }),
    ).toBe("TEST-sandbox");
  });

  it("em sandbox faz fallback para a de produção se ausente", () => {
    expect(
      selectMercadoPagoPublicKey({
        environment: "sandbox",
        productionPublicKey: "APP_USR-prod",
        sandboxPublicKey: null,
      }),
    ).toBe("APP_USR-prod");
  });

  it("em produção usa a de produção", () => {
    expect(
      selectMercadoPagoPublicKey({
        environment: "production",
        productionPublicKey: "APP_USR-prod",
        sandboxPublicKey: "TEST-sandbox",
      }),
    ).toBe("APP_USR-prod");
  });
});
