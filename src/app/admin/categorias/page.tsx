import { CategoryForm } from "@/components/admin/category-form";
import { getCategoryTree } from "@/modules/categories/category.service";
import type { CategoryNode } from "@/modules/categories/tree";
import type { CategoryLike } from "@/modules/categories/tree";

export const dynamic = "force-dynamic";

export const metadata = { title: "Categorias" };

interface FlatCategory extends CategoryLike {
  depth: number;
}

function flatten(nodes: CategoryNode<CategoryLike>[], depth = 0): FlatCategory[] {
  return nodes.flatMap((node) => [
    { ...node.category, depth },
    ...flatten(node.children, depth + 1),
  ]);
}

export default async function AdminCategoriesPage() {
  const tree = await getCategoryTree();
  const flat = flatten(tree);
  const all: CategoryLike[] = flat.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    position: category.position,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
        <p className="text-muted-foreground text-sm">
          Estrutura hierárquica genérica (qualquer segmento).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="bg-background rounded-lg border p-5">
          <h2 className="mb-4 text-sm font-semibold">Árvore</h2>
          <ul className="space-y-1">
            {flat.map((category) => (
              <li
                key={category.id}
                className="text-sm"
                style={{ paddingLeft: `${category.depth * 20}px` }}
              >
                <span className="font-medium">{category.name}</span>
                <span className="text-muted-foreground"> · /{category.slug}</span>
              </li>
            ))}
            {flat.length === 0 ? (
              <li className="text-muted-foreground text-sm">
                Nenhuma categoria cadastrada.
              </li>
            ) : null}
          </ul>
        </div>

        <CategoryForm categories={all} />
      </div>
    </div>
  );
}
