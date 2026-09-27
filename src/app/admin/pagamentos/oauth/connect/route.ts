import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/dal";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createMercadoPagoAuthorization } from "@/modules/payments/oauth/oauth.service";

export const dynamic = "force-dynamic";

/** Inicia o OAuth: registra o state e redireciona para o Mercado Pago. */
export async function GET() {
  try {
    const admin = await requireAdmin();
    const { url } = await createMercadoPagoAuthorization({ userId: admin.id });
    return NextResponse.redirect(url);
  } catch (error) {
    logger.error({
      event: "PAYMENT_OAUTH_CONNECT_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
    const baseUrl = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    return NextResponse.redirect(new URL(`${baseUrl}/admin/pagamentos?oauth=error`));
  }
}
