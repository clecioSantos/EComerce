import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { getSession } from "@/lib/auth/dal";
import { getOrderById } from "@/modules/orders/order.service";
import { ORDER_STATUS_LABELS } from "@/modules/orders/order";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pedido confirmado",
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  if (!orderId) notFound();

  const session = await getSession();
  const order = await getOrderById(orderId);
  if (!order) notFound();
  if (order.userId && order.userId !== session?.user?.id) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <div className="rounded-lg border p-8">
        <h1 className="text-2xl font-bold tracking-tight">Pedido confirmado!</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Obrigado pela compra. Seu pedido é o{" "}
          <strong>{order.number}</strong>.
        </p>

        <p className="mt-4">
          <span className="text-muted-foreground text-sm">Status: </span>
          <strong className="text-sm">
            {ORDER_STATUS_LABELS[order.status]}
          </strong>
        </p>

        <Separator className="my-6" />

        <ul className="space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity}× {item.productName}
                {item.variantName ? ` (${item.variantName})` : ""}
              </span>
              <span>{formatCurrency(Number(item.total))}</span>
            </li>
          ))}
        </ul>

        <Separator className="my-6" />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(Number(order.subtotal))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Descontos</span>
            <span>-{formatCurrency(Number(order.discountTotal))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frete</span>
            <span>{formatCurrency(Number(order.shippingTotal))}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(Number(order.grandTotal))}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button render={<Link href="/produtos" />}>Continuar comprando</Button>
          <Button variant="outline" render={<Link href="/conta/pedidos" />}>
            Meus pedidos
          </Button>
        </div>
      </div>
    </div>
  );
}
