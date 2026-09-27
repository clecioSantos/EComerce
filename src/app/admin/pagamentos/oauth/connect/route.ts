import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/dal";
import { logger } from "@/lib/logger";
import { createMercadoPagoAuthorization } from "@/modules/payments/oauth/oauth.service";

export const dynamic = "force-dynamic";

/** Inicia o OAuth: registra o state e redireciona para o Mercado Pago. */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const { url } = await createMercadoPagoAuthorization({ userId: admin.id });
    return NextResponse.redirect(url);
  } catch (error) {
    logger.error({
      event: "PAYMENT_OAUTH_CONNECT_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL("/admin/pagamentos?oauth=error", request.url));
  }
}
