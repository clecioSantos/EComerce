import { InventoryAdjust } from "@/components/admin/inventory-adjust";
import { VariantLogisticsForm } from "@/components/admin/variant-logistics-form";
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
              <th className="px-4 py-3 font-medium">Envio</th>
              <th className="px-4 py-3 font-medium">Ajustar</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const available = item.quantityOnHand - item.quantityReserved;
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.variant.product.name}</td>
                  <td className="text-muted-foreground px-4 py-3">{item.variant.sku}</td>
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
                    <VariantLogisticsForm
                      variantId={item.variantId}
                      sku={item.variant.sku}
                      weight={
                        item.variant.weight == null ? null : Number(item.variant.weight)
                      }
                      width={
                        item.variant.width == null ? null : Number(item.variant.width)
                      }
                      height={
                        item.variant.height == null ? null : Number(item.variant.height)
                      }
                      length={
                        item.variant.length == null ? null : Number(item.variant.length)
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <InventoryAdjust variantId={item.variantId} />
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">
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
