import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { getCheckoutSummary } from "../src/modules/checkout/checkout.service";
import { calculatePricing } from "../src/modules/pricing/engine";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const coupon = await prisma.coupon.findUnique({ where: { code: "FRETEZERO" } });
  const cart = await prisma.cart.findFirst({
    where: { status: "ACTIVE", userId: { not: null } },
    include: { items: { include: { variant: true, product: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (!coupon || !cart || !cart.userId) {
    console.log("faltando:", {
      coupon: Boolean(coupon),
      cart: Boolean(cart),
      userId: cart?.userId ?? null,
    });
    return;
  }

  const lines = cart.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    categoryId: item.product.categoryId,
    unitPrice: Number(item.variant.price ?? item.product.basePrice),
    quantity: item.quantity,
  }));

  const engine = calculatePricing({
    lines,
    shippingCost: 30,
    coupon: {
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      minSubtotal: coupon.minSubtotal == null ? null : Number(coupon.minSubtotal),
    },
  });
  console.log("engine com cupom:", {
    freeShipping: engine.freeShipping,
    shippingDiscount: engine.shippingDiscount,
    grandTotal: engine.grandTotal,
  });

  const summary = await getCheckoutSummary(cart.userId, {
    couponCode: "FRETEZERO",
  });
  console.log("getCheckoutSummary:", {
    coupon: summary?.coupon?.code ?? null,
    freeShipping: summary?.pricing.freeShipping,
    couponDiscount: summary?.pricing.couponDiscount,
    grandTotal: summary?.pricing.grandTotal,
  });
}

main()
  .catch((error) => console.error(error))
  .finally(() => prisma.$disconnect());
