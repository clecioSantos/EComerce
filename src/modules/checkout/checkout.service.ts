import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { CartDTO } from "@/modules/cart/types";
import { getActiveCart, mapCart } from "@/modules/cart/cart.service";
import { confirmOrderPayment, createOrder } from "@/modules/orders/order.service";
import type { CheckoutOrderInput } from "@/modules/orders/schemas";
import { initiatePayment } from "@/modules/payments/payment.service";
import type { PaymentMethodKind } from "@/modules/payments/types";
import {
  calculatePricing,
  roundMoney,
  type CouponRule,
  type PricingLineInput,
  type PricingResult,
  type PromotionRule,
} from "@/modules/pricing/engine";
import {
  getActivePromotionRules,
  toCouponRule,
  validateCouponForCart,
} from "@/modules/promotions/promotion.service";
import { quoteShipping } from "@/modules/shipping/registry";
import type { ShippingOption } from "@/modules/shipping/types";

import { computeRequestHash } from "./idempotency";

export interface CheckoutContext {
  cartId: string;
  cart: CartDTO;
  lines: PricingLineInput[];
  promotions: PromotionRule[];
}

async function loadContext(userId?: string | null): Promise<CheckoutContext | null> {
  const rawCart = await getActiveCart(userId);
  if (!rawCart || rawCart.items.length === 0) return null;

  // O include do carrinho já traz o produto (basePrice/categoryId), evitando
  // uma segunda query de produtos.
  const cart = mapCart(rawCart);

  const lines: PricingLineInput[] = rawCart.items.map((item) => {
    const unitPrice =
      item.variant.price == null
        ? Number(item.product.basePrice)
        : Number(item.variant.price);
    return {
      id: item.id,
      productId: item.productId,
      categoryId: item.product.categoryId ?? null,
      unitPrice,
      quantity: item.quantity,
    };
  });

  const promotions = await getActivePromotionRules();

  return { cartId: rawCart.id, cart, lines, promotions };
}

export interface CheckoutSummary {
  cart: CartDTO;
  pricing: PricingResult;
  shippingOptions: ShippingOption[];
  selectedShipping: ShippingOption | null;
  coupon: { code: string; rule: CouponRule } | null;
}

async function buildSummary(
  context: CheckoutContext,
  userId: string | null | undefined,
  options: { couponCode?: string | null; shippingOptionId?: string | null } = {},
): Promise<CheckoutSummary> {
  const { cart, lines, promotions } = context;

  let coupon: { code: string; rule: CouponRule } | null = null;
  if (options.couponCode) {
    const validation = await validateCouponForCart(
      options.couponCode,
      cart.subtotal,
      userId,
    );
    if (validation.valid && validation.coupon) {
      coupon = {
        code: validation.coupon.code,
        rule: toCouponRule(validation.coupon),
      };
    }
  }

  const basePricing = calculatePricing({
    lines,
    promotions,
    coupon: coupon?.rule ?? null,
    shippingCost: 0,
  });

  const shippingOptions = await quoteShipping({
    items: cart.items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    })),
    subtotal: basePricing.subtotal,
  });

  const selectedShipping =
    shippingOptions.find((option) => option.id === options.shippingOptionId) ??
    shippingOptions[0] ??
    null;

  const pricing = calculatePricing({
    lines,
    promotions,
    coupon: coupon?.rule ?? null,
    shippingCost: selectedShipping?.price ?? 0,
  });

  return { cart, pricing, shippingOptions, selectedShipping, coupon };
}

export async function getCheckoutSummary(
  userId: string | null | undefined,
  options: { couponCode?: string | null; shippingOptionId?: string | null } = {},
): Promise<CheckoutSummary | null> {
  const context = await loadContext(userId);
  if (!context) return null;
  return buildSummary(context, userId, options);
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
  checkoutUrl?: string;
}

export async function placeOrder(
  userId: string | null | undefined,
  input: CheckoutOrderInput,
): Promise<PlaceOrderResult> {
  const context = await loadContext(userId);
  if (!context) throw new Error("Carrinho vazio.");

  const summary = await buildSummary(context, userId, {
    couponCode: input.couponCode,
    shippingOptionId: input.shippingOptionId,
  });
  if (!summary.selectedShipping) throw new Error("Opção de frete inválida.");

  const discountById = new Map(
    summary.pricing.lines.map((line) => [line.id, line.discount]),
  );

  const orderLines = context.cart.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    productName: item.productName,
    variantName:
      item.variantName ??
      item.attributes.map((attribute) => attribute.value).join(" / ") ??
      null,
    sku: item.sku,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    discount: discountById.get(item.id) ?? 0,
    attributesSnapshot: item.attributes,
    imageUrl: item.image,
  }));

  const selected = summary.selectedShipping;

  const requestHash = computeRequestHash({
    userId: userId ?? null,
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone ?? null,
    },
    shippingAddress: input.shippingAddress,
    shippingOptionId: selected.id,
    paymentMethod: input.paymentMethod,
    couponCode: summary.coupon?.code ?? null,
    items: orderLines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    totals: { grandTotal: summary.pricing.grandTotal },
  });

  // Idempotência: se a chave já produziu um pedido, devolve-o sem repetir efeitos.
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true },
    });
    if (existing) {
      if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new Error("Idempotency-Key reutilizada com um payload diferente.");
      }
      const payment = await prisma.payment.findFirst({
        where: { orderId: existing.id },
        orderBy: { createdAt: "desc" },
      });
      return {
        orderId: existing.id,
        orderNumber: existing.number,
        paymentStatus: payment?.status ?? existing.paymentStatus,
      };
    }
  }

  const order = await createOrder({
    userId: userId ?? null,
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone ?? null,
    },
    shippingAddress: input.shippingAddress,
    billingAddress: input.billingAddress ?? null,
    lines: orderLines,
    totals: {
      subtotal: summary.pricing.subtotal,
      discountTotal: summary.pricing.discountTotal,
      shippingTotal: roundMoney(
        summary.pricing.shippingCost - summary.pricing.shippingDiscount,
      ),
      taxTotal: 0,
      grandTotal: summary.pricing.grandTotal,
      currency: context.cart.currency,
    },
    shipping: { provider: selected.provider, method: selected.label },
    coupon: summary.coupon
      ? {
          id: await resolveCouponId(summary.coupon.code),
          code: summary.coupon.code,
        }
      : null,
    cartId: context.cartId,
    notes: input.notes ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    requestHash,
  });

  // Concorrência: se o pedido já tem pagamento (criado por uma requisição
  // concorrente com a mesma chave), não criamos outro.
  const existingPayment = await prisma.payment.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: "desc" },
  });
  if (existingPayment) {
    return {
      orderId: order.id,
      orderNumber: order.number,
      paymentStatus: existingPayment.status,
    };
  }

  const { intent } = await initiatePayment({
    orderId: order.id,
    amount: summary.pricing.grandTotal,
    currency: context.cart.currency,
    method: input.paymentMethod as PaymentMethodKind,
    customer: { name: input.customer.name, email: input.customer.email },
    metadata: { orderNumber: order.number },
    idempotencyKey: input.idempotencyKey ?? null,
  });

  if (intent.status === "PAID") {
    await confirmOrderPayment(order.id);
  }

  return {
    orderId: order.id,
    orderNumber: order.number,
    paymentStatus: intent.status,
    checkoutUrl: intent.checkoutUrl,
  };
}

async function resolveCouponId(code: string): Promise<string> {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: { id: true },
  });
  if (!coupon) throw new Error("Cupom não encontrado.");
  return coupon.id;
}
