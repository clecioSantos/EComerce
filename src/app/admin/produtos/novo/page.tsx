import Link from "next/link";

import { ProductForm } from "@/components/admin/product-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listProductTypes } from "@/modules/catalog/product-type.service";
import { listCategories } from "@/modules/categories/category.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const [productTypes, categories] = await Promise.all([
    listProductTypes(),
    listCategories(),
  ]);

  if (productTypes.length === 0) {
    return (
      <EmptyState
        title="Nenhum tipo de produto cadastrado"
        description="Crie primeiro um tipo de produto (ex.: Roupas) e configure seus atributos."
        action={
          <Button className="mt-2" render={<Link href="/admin/tipos" />}>
            Criar tipo de produto
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo produto</h1>
        <p className="text-muted-foreground text-sm">
          O tipo de produto define quais atributos e variantes existem.
        </p>
      </div>
      <ProductForm productTypes={productTypes} categories={categories} />
    </div>
  );
}
