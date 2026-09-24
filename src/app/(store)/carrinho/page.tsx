import Link from "next/link";

import { CartItemRow } from "@/components/cart/cart-item-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { getSession } from "@/lib/auth/dal";
import { getCartDTO } from "@/modules/cart/cart.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Carrinho",
};

export default async function CartPage() {
  const session = await getSession();
  const cart = await getCartDTO(session?.user?.id);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16">
        <EmptyState
          title="Seu carrinho está vazio"
          description="Adicione produtos para continuar."
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
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Carrinho</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border px-4">
          {cart.items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}
        </div>

        <aside className="h-fit space-y-4 rounded-lg border p-5 lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold">Resumo</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(cart.subtotal, cart.currency)}</span>
          </div>
          <p className="text-muted-foreground text-xs">
            Frete e descontos são calculados no checkout.
          </p>
          <Button className="w-full" size="lg" render={<Link href="/checkout" />}>
            Ir para o checkout
          </Button>
          <Button
            variant="outline"
            className="w-full"
            render={<Link href="/produtos" />}
          >
            Continuar comprando
          </Button>
        </aside>
      </div>
    </div>
  );
}
