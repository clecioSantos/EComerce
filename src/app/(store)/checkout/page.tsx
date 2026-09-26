import Link from "next/link";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/dal";
import { getCheckoutSummary } from "@/modules/checkout/checkout.service";
import { listCustomerAddresses } from "@/modules/customers/customer.service";

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

  const session = await getSession();
  const summary = await getCheckoutSummary(session?.user?.id, { couponCode });
  const addresses = session?.user?.id ? await listCustomerAddresses(session.user.id) : [];

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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Checkout</h1>

      <CheckoutForm
        cart={summary.cart}
        pricing={summary.pricing}
        couponCode={summary.coupon?.code ?? null}
        addresses={addresses}
        canSaveAddress={Boolean(session?.user?.id)}
        defaultCustomer={{
          name: session?.user?.name ?? "",
          email: session?.user?.email ?? "",
        }}
      />
    </div>
  );
}
