import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { CART_COOKIE } from "@/modules/cart/cart.service";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return new Response("Link inválido.", { status: 404 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = await prisma.agentCheckoutSession.findUnique({
    where: { tokenHash },
    include: { cart: true, store: true },
  });
  if (!session || session.expiresAt <= new Date() || session.usedAt ||
      !session.store.isActive || session.cart.storeId !== session.storeId ||
      session.cart.status !== "ACTIVE" || !session.cart.sessionToken) {
    return new Response("Link expirado ou indisponível.", { status: 410 });
  }

  const updated = await prisma.agentCheckoutSession.updateMany({
    where: { id: session.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (updated.count !== 1) return new Response("Link já utilizado.", { status: 410 });

  const response = NextResponse.redirect(new URL("/checkout", request.url));
  response.cookies.set(CART_COOKIE, session.cart.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}
