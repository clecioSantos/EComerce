import Link from "next/link";

import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { listAllOrders } from "@/modules/orders/order.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pedidos" };

export default async function AdminOrdersPage() {
  const orders = await listAllOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground text-sm">
          {orders.length} pedido(s) recente(s).
        </p>
      </div>

      <div className="bg-background overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-3">
                  <span className="font-medium">{order.number}</span>
                  <span className="text-muted-foreground block text-xs">
                    {formatDateTime(order.createdAt)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span>{order.customerName}</span>
                  <span className="text-muted-foreground block text-xs">
                    {order.customerEmail}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {formatCurrency(Number(order.grandTotal), order.currency)}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusSelect orderId={order.id} status={order.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/admin/pedidos/${order.id}`} />}
                  >
                    Ver
                  </Button>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                  Nenhum pedido.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
