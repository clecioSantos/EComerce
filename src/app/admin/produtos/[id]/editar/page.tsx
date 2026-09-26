import { notFound } from "next/navigation";

import { ProductEditForm } from "@/components/admin/product-edit-form";
import { listCategories } from "@/modules/categories/category.service";
import { getProductForEdit } from "@/modules/products/product.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editar produto" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductForEdit(id),
    listCategories(),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar produto</h1>
        <p className="text-muted-foreground text-sm">{product.name}</p>
      </div>
      <ProductEditForm product={product} categories={categories} />
    </div>
  );
}
