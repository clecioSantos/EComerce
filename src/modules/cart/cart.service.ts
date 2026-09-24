import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { Prisma } from "@/generated/prisma/client";
import { isUniqueConstraintError } from "@/lib/db/errors";
import { prisma } from "@/lib/db/prisma";
import { multiplyMoney, roundMoney } from "@/modules/pricing/engine";

import { cartItemCount, clampQuantity } from "./cart";
import type { CartDTO, CartItemDTO } from "./types";

export const CART_COOKIE = "cart_session";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      product: { include: { images: { orderBy: { position: "asc" } } } },
      variant: {
        include: {
          inventory: true,
          attributes: { include: { attribute: true, attributeValue: true } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export const EMPTY_CART: CartDTO = {
  id: "",
  currency: "BRL",
  items: [],
  itemCount: 0,
  subtotal: 0,
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

export function mapCart(cart: CartWithItems): CartDTO {
  const items: CartItemDTO[] = cart.items.map((item) => {
    const unitPrice =
      item.variant.price == null
        ? toNumber(item.product.basePrice)
        : toNumber(item.variant.price);

    const inventory = item.variant.inventory;
    const image =
      item.product.images.find((img) => img.isPrimary)?.url ??
      item.product.images[0]?.url ??
      null;

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.product.name,
      productSlug: item.product.slug,
      variantName: item.variant.name,
      sku: item.variant.sku,
      unitPrice,
      compareAtPrice:
        item.variant.compareAtPrice == null
          ? null
          : toNumber(item.variant.compareAtPrice),
      quantity: item.quantity,
      lineTotal: multiplyMoney(unitPrice, item.quantity),
      image,
      attributes: item.variant.attributes.map((link) => ({
        attributeName: link.attribute.name,
        value: link.attributeValue.value,
      })),
      availableStock: inventory
        ? inventory.quantityOnHand - inventory.quantityReserved
        : null,
      allowBackorder: inventory?.allowBackorder ?? false,
    };
  });

  const subtotal = roundMoney(
    items.reduce((total, item) => total + item.lineTotal, 0),
  );

  return {
    id: cart.id,
    currency: cart.currency,
    items,
    itemCount: cartItemCount(items),
    subtotal,
  };
}

export async function readCartToken(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE)?.value;
}

export async function getActiveCart(userId?: string | null) {
  if (userId) {
    return prisma.cart.findFirst({
      where: { userId, status: "ACTIVE" },
      include: cartInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  const token = await readCartToken();
  if (!token) return null;

  return prisma.cart.findUnique({ where: { sessionToken: token }, include: cartInclude });
}

export async function getCartDTO(userId?: string | null): Promise<CartDTO> {
  const cart = await getActiveCart(userId);
  if (!cart) return EMPTY_CART;
  return mapCart(cart);
}

/** Cria/recupera um carrinho para o usuário autenticado. */
export async function getOrCreateUserCart(userId: string) {
  const existing = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  try {
    return await prisma.cart.create({ data: { userId, status: "ACTIVE" } });
  } catch (error) {
    // Corrida: outro request criou o carrinho ACTIVE primeiro (índice parcial).
    if (isUniqueConstraintError(error)) {
      const raced = await prisma.cart.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

/**
 * Cria/recupera um carrinho (usuário ou convidado). Define o cookie de sessão
 * do convidado — só pode ser chamado em Server Action ou Route Handler.
 */
export async function getOrCreateCart(userId?: string | null) {
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    // Sessão obsoleta (usuário removido/recriado): cai para carrinho de convidado
    // em vez de violar a FK `carts_userId_fkey`.
    if (user) return getOrCreateUserCart(userId);
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE)?.value;

  if (token) {
    const existing = await prisma.cart.findUnique({
      where: { sessionToken: token },
    });
    if (existing) return existing;
  }

  const newToken = randomUUID();
  const cart = await prisma.cart.create({
    data: { sessionToken: newToken, status: "ACTIVE" },
  });

  cookieStore.set(CART_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });

  return cart;
}

export async function addItemToCart(params: {
  cartId: string;
  variantId: string;
  quantity: number;
}) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: params.variantId },
    select: { id: true, productId: true },
  });
  if (!variant) throw new Error("Variante não encontrada.");

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: params.cartId, variantId: params.variantId } },
  });

  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: clampQuantity(existing.quantity + params.quantity) },
    });
  }

  return prisma.cartItem.create({
    data: {
      cartId: params.cartId,
      productId: variant.productId,
      variantId: params.variantId,
      quantity: clampQuantity(params.quantity),
    },
  });
}

export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  if (quantity <= 0) {
    return prisma.cartItem.delete({ where: { id: cartItemId } });
  }
  return prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity: clampQuantity(quantity) },
  });
}

export async function removeCartItem(cartItemId: string) {
  return prisma.cartItem.delete({ where: { id: cartItemId } });
}

export async function clearCart(cartId: string) {
  return prisma.cartItem.deleteMany({ where: { cartId } });
}

/** Migra itens de um carrinho convidado para o carrinho do usuário no login. */
export async function mergeGuestCartIntoUserCart(
  userId: string,
  guestToken: string,
) {
  const guestCart = await prisma.cart.findUnique({
    where: { sessionToken: guestToken },
    include: { items: true },
  });
  if (!guestCart || guestCart.items.length === 0) return;

  const userCart = await getOrCreateUserCart(userId);

  await prisma.$transaction(async (tx) => {
    for (const item of guestCart.items) {
      await tx.cartItem.upsert({
        where: {
          cartId_variantId: { cartId: userCart.id, variantId: item.variantId },
        },
        create: {
          cartId: userCart.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        },
        update: {
          quantity: clampQuantity(item.quantity),
        },
      });
    }
    await tx.cart.delete({ where: { id: guestCart.id } });
  });
}
