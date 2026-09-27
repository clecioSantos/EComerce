import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth/dal";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { MercadoPagoError } from "@/modules/payments/providers/mercadopago/errors";
import { completeMercadoPagoOAuth } from "@/modules/payments/oauth/oauth.service";

export const dynamic = "force-dynamic";

/** Callback do OAuth: valida o state, troca o code e persiste os tokens. */
export async function GET(request: NextRequest) {
  // Base pública configurada (atrás de proxy, `request.url` pode ser 0.0.0.0).
  const baseUrl = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  const target = (status: string, reason?: string) => {
    const url = new URL(`${baseUrl}/admin/pagamentos`);
    url.searchParams.set("oauth", status);
    if (reason) url.searchParams.set("reason", reason);
    return NextResponse.redirect(url);
  };

  let adminId: string;
  try {
    const admin = await requireAdmin();
    adminId = admin.id;
  } catch {
    return NextResponse.redirect(
      new URL(`${baseUrl}/login?callbackUrl=/admin/pagamentos`),
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    logger.warn({
      event: "PAYMENT_OAUTH_CALLBACK_REJECTED",
      reason: oauthError,
      description: request.nextUrl.searchParams.get("error_description") ?? undefined,
    });
    return target("error", "denied");
  }
  if (!code || !state) {
    logger.warn({ event: "PAYMENT_OAUTH_CALLBACK_REJECTED", reason: "missing_params" });
    return target("error", "missing_params");
  }

  try {
    const result = await completeMercadoPagoOAuth({ code, state });
    if (result.userId !== adminId) {
      // O state pertence a outro usuário: não vincula a conta.
      logger.error({ event: "PAYMENT_OAUTH_STATE_MISMATCH" });
      return target("error", "state_mismatch");
    }
    return target("success");
  } catch (error) {
    const reason =
      error instanceof MercadoPagoError && error.code ? error.code : "exchange_failed";
    logger.error({
      event: "PAYMENT_OAUTH_CALLBACK_FAILED",
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
    return target("error", reason);
  }
}
