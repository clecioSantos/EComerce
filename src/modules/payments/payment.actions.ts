"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { logger } from "@/lib/logger";

import { disconnectMercadoPago } from "./oauth/account.service";

export interface PaymentActionResult {
  ok: boolean;
  error?: string;
}

export async function disconnectMercadoPagoAction(): Promise<PaymentActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Acesso restrito a administradores." };
  }

  try {
    await disconnectMercadoPago();
    revalidatePath("/admin/pagamentos");
    return { ok: true };
  } catch (error) {
    logger.error({
      event: "PAYMENT_OAUTH_DISCONNECT_FAILED",
      provider: "mercadopago",
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: "Não foi possível desconectar a conta." };
  }
}
