import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth/dal";
import { ORDER_STATUS_LABELS } from "@/modules/orders/order";
import { listUserOrders } from "@/modules/orders/order.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meus pedidos",
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/conta/pedidos");

  const orders = await listUserOrders(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Meus pedidos</h1>

      {orders.length === 0 ? (
        <EmptyState
          title="Você ainda não fez pedidos"
          description="Quando comprar, seus pedidos aparecerão aqui."
          action={
            <Button className="mt-2" render={<Link href="/produtos" />}>
              Ver produtos
            </Button>
          }
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-5"
            >
              <div>
                <p className="text-sm font-medium">{order.number}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(order.createdAt)} · {order.items.length} item(ns)
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
                <span className="text-sm font-semibold">
                  {formatCurrency(Number(order.grandTotal))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/conta/pedidos/${order.id}`} />}
                >
                  Detalhes
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
