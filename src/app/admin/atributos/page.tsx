import { AttributeForm } from "@/components/admin/attribute-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { listProductTypes } from "@/modules/catalog/product-type.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Atributos" };

export default async function AdminAttributesPage() {
  const [productTypes, attributes] = await Promise.all([
    listProductTypes(),
    prisma.productAttribute.findMany({
      include: {
        productType: { select: { name: true } },
        values: { orderBy: { position: "asc" } },
      },
      orderBy: [{ productTypeId: "asc" }, { position: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Atributos</h1>
        <p className="text-muted-foreground text-sm">
          Atributos genéricos: texto, número, seleção, etc.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="bg-background overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Atributo</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {attributes.map((attribute) => (
                <tr key={attribute.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{attribute.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {attribute.productType.name} · /{attribute.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{attribute.type}</Badge>
                    {attribute.values.length > 0 ? (
                      <span className="text-muted-foreground block text-xs">
                        {attribute.values.map((value) => value.value).join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {attribute.isVariantDefining ? (
                        <Badge variant="outline">variante</Badge>
                      ) : null}
                      {attribute.isFilterable ? (
                        <Badge variant="outline">filtro</Badge>
                      ) : null}
                      {attribute.isRequired ? (
                        <Badge variant="outline">obrigatório</Badge>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {attributes.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="text-muted-foreground px-4 py-8 text-center"
                  >
                    Nenhum atributo cadastrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {productTypes.length > 0 ? (
          <AttributeForm productTypes={productTypes} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Crie um tipo de produto antes de adicionar atributos.
          </p>
        )}
      </div>
    </div>
  );
}
