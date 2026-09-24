import { InventoryAdjust } from "@/components/admin/inventory-adjust";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Estoque" };

export default async function AdminInventoryPage() {
  const items = await prisma.inventory.findMany({
    include: {
      variant: { include: { product: { select: { name: true, slug: true } } } },
    },
    orderBy: { quantityOnHand: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
        <p className="text-muted-foreground text-sm">
          O estoque pertence à variante. Ajustes são registrados no histórico.
        </p>
      </div>

      <div className="bg-background overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Físico</th>
              <th className="px-4 py-3 font-medium">Reservado</th>
              <th className="px-4 py-3 font-medium">Disponível</th>
              <th className="px-4 py-3 font-medium">Ajustar</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const available = item.quantityOnHand - item.quantityReserved;
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.variant.product.name}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {item.variant.sku}
                  </td>
                  <td className="px-4 py-3">{item.quantityOnHand}</td>
                  <td className="px-4 py-3">{item.quantityReserved}</td>
                  <td className="px-4 py-3">
                    {available <= item.reorderLevel ? (
                      <Badge variant="destructive">{available}</Badge>
                    ) : (
                      <span>{available}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <InventoryAdjust variantId={item.variantId} />
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
                  Nenhum item em estoque.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
