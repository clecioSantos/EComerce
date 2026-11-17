import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { CART_COOKIE } from "@/modules/cart/cart.service";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response("Link inválido.", { status: 404 });
  // Messaging apps fetch link previews. Never consume a checkout token on GET.
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Finalizar compra</title></head><body style="font-family:system-ui;max-width:480px;margin:60px auto;padding:20px"><h1>Continuar sua compra</h1><p>Confira seus produtos e finalize com segurança no site da loja.</p><form method="post"><button style="cursor:pointer;padding:14px 24px;border:0;border-radius:6px;background:#202020;color:#fff;font-size:16px">Ir para o checkout</button></form></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
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

  const response = NextResponse.redirect(new URL("/checkout", request.url), 303);
  response.cookies.set(CART_COOKIE, session.cart.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}
