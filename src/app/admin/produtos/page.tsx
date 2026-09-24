import Link from "next/link";

import { ProductStatusSelect } from "@/components/admin/product-status-select";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/db/prisma";
import {
  mapProductSummary,
  productSummaryInclude,
} from "@/modules/products/product.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produtos" };

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: productSummaryInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const items = products.map(mapProductSummary);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground text-sm">
            {items.length} produto(s) cadastrado(s).
          </p>
        </div>
        <Button render={<Link href="/admin/produtos/novo" />}>
          Novo produto
        </Button>
      </div>

      <div className="bg-background overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Preço</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3">
                  <span className="font-medium">{product.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {product.slug}
                  </span>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {product.productTypeSlug}
                </td>
                <td className="px-4 py-3">
                  {formatCurrency(product.basePrice, product.currency)}
                </td>
                <td className="px-4 py-3">
                  <ProductStatusSelect
                    productId={product.id}
                    status={product.status}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/produtos/${product.slug}`} target="_blank" />}
                  >
                    Ver
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
