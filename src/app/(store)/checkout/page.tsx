import Link from "next/link";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { getSession } from "@/lib/auth/dal";
import { getCheckoutSummary } from "@/modules/checkout/checkout.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const couponCode = typeof params.coupon === "string" ? params.coupon : undefined;
  const shippingOptionId =
    typeof params.shippingOptionId === "string" ? params.shippingOptionId : undefined;

  const session = await getSession();
  const summary = await getCheckoutSummary(session?.user?.id, {
    couponCode,
    shippingOptionId,
  });

  if (!summary) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16">
        <EmptyState
          title="Nada para finalizar"
          description="Seu carrinho está vazio."
          action={
            <Button className="mt-2" render={<Link href="/produtos" />}>
              Ver produtos
            </Button>
          }
        />
      </div>
    );
  }

  const { pricing } = summary;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <CheckoutForm
          shippingOptions={summary.shippingOptions}
          selectedShippingId={summary.selectedShipping?.id ?? null}
          couponCode={summary.coupon?.code ?? null}
          defaultCustomer={{
            name: session?.user?.name ?? "",
            email: session?.user?.email ?? "",
          }}
        />

        <aside className="h-fit space-y-4 rounded-lg border p-5 lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold">Resumo do pedido</h2>
          <ul className="space-y-3">
            {summary.cart.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {item.quantity}× {item.productName}
                </span>
                <span>{formatCurrency(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(pricing.subtotal)}</span>
            </div>
            {pricing.promotionsDiscount > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Promoções</span>
                <span>-{formatCurrency(pricing.promotionsDiscount)}</span>
              </div>
            ) : null}
            {pricing.couponDiscount > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Cupom {summary.coupon?.code}
                </span>
                <span>-{formatCurrency(pricing.couponDiscount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frete</span>
              <span>
                {pricing.shippingDiscount >= pricing.shippingCost
                  ? "Grátis"
                  : formatCurrency(pricing.shippingCost - pricing.shippingDiscount)}
              </span>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(pricing.grandTotal)}</span>
          </div>
          {summary.coupon ? (
            <p className="text-muted-foreground text-xs">
              Cupom <strong>{summary.coupon.code}</strong> aplicado.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
