import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { countProducts } from "@/modules/products/product.service";
import { countCustomers } from "@/modules/customers/customer.service";
import { listLowStock } from "@/modules/inventory/inventory.service";
import { getOrderCount, getRevenueTotal } from "@/modules/orders/order.service";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [activeProducts, customers, orders, revenue, lowStock] = await Promise.all([
    countProducts("ACTIVE"),
    countCustomers(),
    getOrderCount(),
    getRevenueTotal(),
    listLowStock(),
  ]);

  const stats = [
    { label: "Produtos ativos", value: String(activeProducts), href: "/admin/produtos" },
    { label: "Pedidos", value: String(orders), href: "/admin/pedidos" },
    { label: "Clientes", value: String(customers), href: "/admin/clientes" },
    { label: "Receita paga", value: formatCurrency(revenue), href: "/admin/pedidos" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Visão geral da operação.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-background hover:bg-accent/50 rounded-lg border p-5 transition-colors"
          >
            <p className="text-muted-foreground text-sm">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="bg-background rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Estoque baixo</h2>
        {lowStock.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nenhum item com estoque baixo.
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {lowStock.slice(0, 8).map((item) => (
              <li key={item.id} className="flex justify-between py-2 text-sm">
                <span>
                  {item.variant.product.name}
                  <span className="text-muted-foreground"> · {item.variant.sku}</span>
                </span>
                <span className="text-muted-foreground">
                  {item.quantityOnHand - item.quantityReserved} disponível
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
