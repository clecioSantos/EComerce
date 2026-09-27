import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificação da assinatura HMAC dos webhooks do Mercado Pago.
 *
 * O header `x-signature` tem o formato `ts=<timestamp>,v1=<hash>`. O hash é
 * HMAC-SHA256 (hex) do manifest:
 *
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * usando o segredo de assinatura do webhook. Também validamos o timestamp para
 * mitigar replay. Assinatura inválida NUNCA deve ser aceita.
 */
export interface ParsedSignature {
  ts: string;
  v1: string;
}

export function parseSignatureHeader(
  header: string | null | undefined,
): ParsedSignature | null {
  if (!header) return null;
  const parts = header.split(",");
  let ts = "";
  let v1 = "";
  for (const part of parts) {
    const [key, value] = part.split("=").map((segment) => segment.trim());
    if (key === "ts") ts = value ?? "";
    if (key === "v1") v1 = value ?? "";
  }
  if (!ts || !v1) return null;
  return { ts, v1 };
}

export function buildManifest(params: {
  dataId?: string | null;
  requestId?: string | null;
  ts: string;
}): string {
  return `id:${params.dataId ?? ""};request-id:${params.requestId ?? ""};ts:${params.ts};`;
}

export function computeSignature(secret: string, manifest: string): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

export interface VerifySignatureResult {
  valid: boolean;
  reason?: "missing_header" | "invalid_format" | "mismatch" | "expired";
}

export function verifyMercadoPagoSignature(params: {
  signatureHeader?: string | null;
  requestId?: string | null;
  dataId?: string | null;
  secret?: string | null;
  now?: number;
  toleranceMs?: number;
}): VerifySignatureResult {
  const { signatureHeader, requestId, dataId, secret } = params;
  const now = params.now ?? Date.now();
  const toleranceMs = params.toleranceMs ?? 10 * 60 * 1000;

  if (!signatureHeader || !secret) return { valid: false, reason: "missing_header" };

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return { valid: false, reason: "invalid_format" };

  const tsMs = Number(parsed.ts) * (parsed.ts.length <= 10 ? 1000 : 1);
  if (!Number.isFinite(tsMs)) return { valid: false, reason: "invalid_format" };
  if (Math.abs(now - tsMs) > toleranceMs) return { valid: false, reason: "expired" };

  const manifest = buildManifest({ dataId, requestId, ts: parsed.ts });
  const expected = computeSignature(secret, manifest);

  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(parsed.v1, "utf8");
  if (expectedBuf.length !== actualBuf.length) {
    return { valid: false, reason: "mismatch" };
  }
  if (!timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, reason: "mismatch" };
  }
  return { valid: true };
}
