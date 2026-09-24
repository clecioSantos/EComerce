import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth/dal";
import { ORDER_STATUS_LABELS } from "@/modules/orders/order";
import { getOrderById } from "@/modules/orders/order.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detalhes do pedido",
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=/conta/pedidos/${id}`);

  const order = await getOrderById(id, user.id);
  if (!order) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        render={<Link href="/conta/pedidos" />}
      >
        Voltar
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{order.number}</h1>
          <p className="text-muted-foreground text-sm">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status]}</Badge>
      </div>

      <Separator className="my-6" />

      <ul className="space-y-4">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>
              {item.quantity}× {item.productName}
              {item.variantName ? ` (${item.variantName})` : ""}
              <span className="text-muted-foreground block text-xs">
                SKU {item.sku}
              </span>
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
    </div>
  );
}
