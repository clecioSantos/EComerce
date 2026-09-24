"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/dal";

import { placeOrder } from "./checkout.service";
import { checkoutOrderSchema, type CheckoutOrderInput } from "@/modules/orders/schemas";

export interface PlaceOrderActionResult {
  ok: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
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
    return { ok: true, orderId: result.orderId, orderNumber: result.orderNumber };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o pedido.",
    };
  }
}
