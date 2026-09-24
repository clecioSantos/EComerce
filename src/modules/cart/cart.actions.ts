"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/dal";

import {
  addItemToCart,
  clearCart,
  getOrCreateCart,
  removeCartItem,
  updateCartItemQuantity,
} from "./cart.service";
import {
  addToCartSchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from "./schemas";

export interface CartActionResult {
  ok: boolean;
  error?: string;
}

async function currentUserId() {
  // Usa o usuário verificado no banco: evita confiar em um JWT de sessão cujo
  // usuário já não existe (ex.: banco recriado/seed).
  const user = await getCurrentUser();
  return user?.id ?? null;
}

function revalidateCart() {
  revalidatePath("/carrinho");
  revalidatePath("/checkout");
  revalidatePath("/", "layout");
}

export async function addToCartAction(input: {
  variantId: string;
  quantity?: number;
}): Promise<CartActionResult> {
  try {
    const parsed = addToCartSchema.parse(input);
    const cart = await getOrCreateCart(await currentUserId());
    await addItemToCart({
      cartId: cart.id,
      variantId: parsed.variantId,
      quantity: parsed.quantity,
    });
    revalidateCart();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao adicionar item.",
    };
  }
}

export async function updateCartItemAction(input: {
  cartItemId: string;
  quantity: number;
}): Promise<CartActionResult> {
  try {
    const parsed = updateCartItemSchema.parse(input);
    await updateCartItemQuantity(parsed.cartItemId, parsed.quantity);
    revalidateCart();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar item.",
    };
  }
}

export async function removeCartItemAction(input: {
  cartItemId: string;
}): Promise<CartActionResult> {
  try {
    const parsed = removeCartItemSchema.parse(input);
    await removeCartItem(parsed.cartItemId);
    revalidateCart();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao remover item.",
    };
  }
}

export async function clearCartAction(): Promise<CartActionResult> {
  try {
    const cart = await getOrCreateCart(await currentUserId());
    await clearCart(cart.id);
    revalidateCart();
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao limpar carrinho." };
  }
}
