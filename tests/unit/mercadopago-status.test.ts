import { describe, expect, it } from "vitest";

import {
  isFinalMercadoPagoStatus,
  mapMercadoPagoStatus,
} from "@/modules/payments/providers/mercadopago/status";

describe("mapMercadoPagoStatus", () => {
  it("mapeia approved para PAID", () => {
    expect(mapMercadoPagoStatus("approved")).toBe("PAID");
  });

  it("mantém pending/in_process como PENDING", () => {
    expect(mapMercadoPagoStatus("pending")).toBe("PENDING");
    expect(mapMercadoPagoStatus("in_process")).toBe("PENDING");
  });

  it("mapeia authorized para AUTHORIZED", () => {
    expect(mapMercadoPagoStatus("authorized")).toBe("AUTHORIZED");
  });

  it("mapeia rejected para FAILED", () => {
    expect(mapMercadoPagoStatus("rejected")).toBe("FAILED");
  });

  it("mapeia cancelled/canceled para CANCELED", () => {
    expect(mapMercadoPagoStatus("cancelled")).toBe("CANCELED");
    expect(mapMercadoPagoStatus("canceled")).toBe("CANCELED");
  });

  it("mapeia refunded e charged_back para REFUNDED", () => {
    expect(mapMercadoPagoStatus("refunded")).toBe("REFUNDED");
    expect(mapMercadoPagoStatus("charged_back")).toBe("REFUNDED");
  });

  it("mapeia expired para CANCELED (não existe EXPIRED em PaymentStatus)", () => {
    expect(mapMercadoPagoStatus("expired")).toBe("CANCELED");
  });

  it("é case-insensitive e tolera desconhecidos/nulos", () => {
    expect(mapMercadoPagoStatus("APPROVED")).toBe("PAID");
    expect(mapMercadoPagoStatus("desconhecido")).toBe("PENDING");
    expect(mapMercadoPagoStatus(null)).toBe("PENDING");
  });
});

describe("isFinalMercadoPagoStatus", () => {
  it("identifica estados terminais", () => {
    expect(isFinalMercadoPagoStatus("approved")).toBe(true);
    expect(isFinalMercadoPagoStatus("rejected")).toBe(true);
    expect(isFinalMercadoPagoStatus("refunded")).toBe(true);
    expect(isFinalMercadoPagoStatus("approved")).toBe(true);
  });

  it("não considera pending/in_process terminais", () => {
    expect(isFinalMercadoPagoStatus("pending")).toBe(false);
    expect(isFinalMercadoPagoStatus("in_process")).toBe(false);
    expect(isFinalMercadoPagoStatus(null)).toBe(false);
  });
});
