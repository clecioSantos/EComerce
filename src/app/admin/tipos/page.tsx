import { ProductTypeForm } from "@/components/admin/product-type-form";
import { Badge } from "@/components/ui/badge";
import { listProductTypes } from "@/modules/catalog/product-type.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tipos de produto" };

export default async function AdminProductTypesPage() {
  const productTypes = await listProductTypes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tipos de produto</h1>
        <p className="text-muted-foreground text-sm">
          Cada tipo define quais atributos e variantes os produtos possuem.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          {productTypes.map((productType) => (
            <div key={productType.id} className="bg-background rounded-lg border p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{productType.name}</h2>
                <span className="text-muted-foreground text-xs">
                  /{productType.slug}
                </span>
              </div>
              {productType.description ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  {productType.description}
                </p>
              ) : null}
              <ul className="mt-3 flex flex-wrap gap-2">
                {productType.attributes.map((attribute) => (
                  <li key={attribute.id}>
                    <Badge variant={attribute.isVariantDefining ? "default" : "secondary"}>
                      {attribute.name}
                      {attribute.isVariantDefining ? " (variante)" : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {productTypes.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum tipo de produto cadastrado.
            </p>
          ) : null}
        </div>

        <ProductTypeForm />
      </div>
    </div>
  );
}
