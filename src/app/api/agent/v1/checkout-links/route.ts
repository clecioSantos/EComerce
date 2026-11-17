import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { authenticateAgent, agentError } from "@/lib/agent-api/auth";
import { prisma } from "@/lib/db/prisma";

const requestSchema = z.object({
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().min(1).max(50),
  })).min(1).max(30),
});

export async function POST(request: Request) {
  try {
    const { storeId } = await authenticateAgent(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Itens inválidos." }, { status: 400 });

    const combined = new Map<string, number>();
    for (const item of parsed.data.items) {
      combined.set(item.variantId, (combined.get(item.variantId) ?? 0) + item.quantity);
    }
    if ([...combined.values()].some((quantity) => quantity > 50)) {
      return Response.json({ error: "Quantidade excedida." }, { status: 400 });
    }
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: [...combined.keys()] }, isActive: true, product: { storeId, status: "ACTIVE" } },
      include: { product: true, inventory: true },
    });
    if (variants.length !== combined.size) {
      return Response.json({ error: "Produto ou variante indisponível." }, { status: 400 });
    }
    for (const variant of variants) {
      const inventory = variant.inventory;
      const quantity = combined.get(variant.id)!;
      if (!inventory || (!inventory.allowBackorder && inventory.quantityOnHand - inventory.quantityReserved < quantity)) {
        return Response.json({ error: "Estoque insuficiente.", variantId: variant.id }, { status: 409 });
      }
    }

    // An opaque, short-lived token is exchanged for the normal browser cart cookie.
    // Prices, shipping and promotions are always recalculated by the store checkout.
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const cartToken = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.create({
        data: {
          storeId,
          status: "ACTIVE",
          sessionToken: cartToken,
          items: { create: variants.map((variant) => ({
            productId: variant.productId,
            variantId: variant.id,
            quantity: combined.get(variant.id)!,
          })) },
        },
      });
      await tx.agentCheckoutSession.create({
        data: { storeId, cartId: cart.id, tokenHash, expiresAt },
      });
    });

    const url = new URL("/agent-checkout/" + token, process.env.NEXT_PUBLIC_SITE_URL || request.url);
    return Response.json({ checkoutUrl: url.toString(), expiresAt: expiresAt.toISOString() }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }
    return agentError(error);
  }
}
