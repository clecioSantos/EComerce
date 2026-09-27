"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/dal";

import { placeOrder, type PaymentResult } from "./checkout.service";
import { checkoutOrderSchema, type CheckoutOrderInput } from "@/modules/orders/schemas";
import {
  friendlyMercadoPagoMessage,
  MercadoPagoError,
} from "@/modules/payments/providers/mercadopago/errors";

export interface PlaceOrderActionResult {
  ok: boolean;
  orderId?: string;
  orderNumber?: string;
  paymentStatus?: string;
  payment?: PaymentResult | null;
  error?: string;
  /** Detalhe técnico (sem secrets) para depuração no console do navegador. */
  detail?: {
    kind?: string;
    status?: number;
    code?: string;
    message?: string;
    /** Payload (redigido) enviado ao Mercado Pago. */
    payload?: unknown;
  };
}

export async function placeOrderAction(
  input: CheckoutOrderInput,
): Promise<PlaceOrderActionResult> {
  try {
    const parsed = checkoutOrderSchema.parse(input);
    const user = await getCurrentUser();
    const result = await placeOrder(user?.id ?? null, parsed);
    revalidatePath("/carrinho");
    revalidatePath("/conta/pedidos");
    return {
      ok: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      paymentStatus: result.paymentStatus,
      payment: result.payment ?? null,
    };
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      return {
        ok: false,
        error: friendlyMercadoPagoMessage(error),
        detail: {
          kind: error.kind,
          status: error.status,
          code: error.code,
          message: error.message,
          payload: error.requestPayload,
        },
      };
    }
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Não foi possível concluir o pedido.",
    };
  }
}
