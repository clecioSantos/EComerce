import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth/dal";
import { logger } from "@/lib/logger";
import { completeMercadoPagoOAuth } from "@/modules/payments/oauth/oauth.service";

export const dynamic = "force-dynamic";

/** Callback do OAuth: valida o state, troca o code e persiste os tokens. */
export async function GET(request: NextRequest) {
  const target = (status: string) =>
    NextResponse.redirect(new URL(`/admin/pagamentos?oauth=${status}`, request.url));

  let adminId: string;
  try {
    const admin = await requireAdmin();
    adminId = admin.id;
  } catch {
    return NextResponse.redirect(
      new URL("/login?callbackUrl=/admin/pagamentos", request.url),
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError || !code || !state) {
    logger.warn({
      event: "PAYMENT_OAUTH_CALLBACK_REJECTED",
      reason: oauthError ?? "missing",
    });
    return target("error");
  }

  try {
    const result = await completeMercadoPagoOAuth({ code, state });
    if (result.userId !== adminId) {
      // O state pertence a outro usuário: não vincula a conta.
      logger.error({ event: "PAYMENT_OAUTH_STATE_MISMATCH" });
      return target("error");
    }
    return target("success");
  } catch (error) {
    logger.error({
      event: "PAYMENT_OAUTH_CALLBACK_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
    return target("error");
  }
}
