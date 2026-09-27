import { describe, expect, it } from "vitest";

import {
  buildManifest,
  computeSignature,
  parseSignatureHeader,
  verifyMercadoPagoSignature,
} from "@/modules/payments/providers/mercadopago/signature";

const SECRET = "super-secret";

function signedHeader(params: { dataId: string; requestId: string; ts: string }) {
  const manifest = buildManifest(params);
  return `ts=${params.ts},v1=${computeSignature(SECRET, manifest)}`;
}

describe("parseSignatureHeader", () => {
  it("extrai ts e v1", () => {
    expect(parseSignatureHeader("ts=1704908010,v1=abc")).toEqual({
      ts: "1704908010",
      v1: "abc",
    });
  });

  it("retorna null quando o formato é inválido", () => {
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader("foo=bar")).toBeNull();
  });
});

describe("buildManifest", () => {
  it("segue o template oficial id/request-id/ts", () => {
    expect(buildManifest({ dataId: "123", requestId: "req-1", ts: "1704908010" })).toBe(
      "id:123;request-id:req-1;ts:1704908010;",
    );
  });
});

describe("verifyMercadoPagoSignature", () => {
  const ts = String(Math.floor(Date.now() / 1000));

  it("aceita assinatura válida", () => {
    const result = verifyMercadoPagoSignature({
      signatureHeader: signedHeader({ dataId: "123", requestId: "req-1", ts }),
      requestId: "req-1",
      dataId: "123",
      secret: SECRET,
    });
    expect(result.valid).toBe(true);
  });

  it("rejeita assinatura divergente", () => {
    const result = verifyMercadoPagoSignature({
      signatureHeader: signedHeader({ dataId: "123", requestId: "req-1", ts }),
      requestId: "req-1",
      dataId: "999",
      secret: SECRET,
    });
    expect(result).toEqual({ valid: false, reason: "mismatch" });
  });

  it("rejeita cabeçalho ausente e segredo ausente", () => {
    expect(
      verifyMercadoPagoSignature({ requestId: "req-1", dataId: "123", secret: SECRET })
        .valid,
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: signedHeader({ dataId: "123", requestId: "req-1", ts }),
        requestId: "req-1",
        dataId: "123",
        secret: undefined,
      }).valid,
    ).toBe(false);
  });

  it("rejeita timestamp expirado (proteção contra replay)", () => {
    const oldTs = String(Math.floor(Date.now() / 1000) - 3600);
    const result = verifyMercadoPagoSignature({
      signatureHeader: signedHeader({ dataId: "123", requestId: "req-1", ts: oldTs }),
      requestId: "req-1",
      dataId: "123",
      secret: SECRET,
    });
    expect(result).toEqual({ valid: false, reason: "expired" });
  });
});
