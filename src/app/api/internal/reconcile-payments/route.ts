import { NextResponse, type NextRequest } from "next/server";

import { isAuthorizedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { reconcileMercadoPagoPayments } from "@/modules/payments/reconciliation.service";

export const dynamic = "force-dynamic";

/**
 * Endpoint de manutenção: reconcilia pagamentos pendentes do Mercado Pago.
 * Protegido por `CRON_SECRET` (x-cron-secret ou Bearer). Pode ser chamado por
 * um cron externo periodicamente (ex.: a cada 10 minutos).
 */
async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const withinHours = Number(url.searchParams.get("withinHours") ?? "48");
  const limit = Number(url.searchParams.get("limit") ?? "50");

  try {
    const result = await reconcileMercadoPagoPayments({
      withinHours: Number.isFinite(withinHours) ? withinHours : 48,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error({
      event: "PAYMENT_RECONCILIATION_FAILED",
      provider: "mercadopago",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Falha ao reconciliar pagamentos." },
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
