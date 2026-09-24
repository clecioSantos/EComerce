import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { expireOverdueReservations } from "@/modules/inventory/expiration.service";

export const dynamic = "force-dynamic";

/**
 * Endpoint de manutenção: expira reservas vencidas. Deve ser chamado por um
 * cron/job externo com o header `x-cron-secret` (ou `Authorization: Bearer`).
 * Protegido: sem segredo configurado ou com segredo inválido, responde 401.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const provided = (request.headers.get("x-cron-secret") ?? bearer ?? "").trim();
  if (!provided) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await expireOverdueReservations();
    logger.info({ event: "RESERVATIONS_EXPIRED", ...result });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error({
      event: "RESERVATIONS_EXPIRATION_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Falha ao expirar reservas." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
