import Link from "next/link";

import { ProductGrid } from "@/components/product/product-grid";
import { Button } from "@/components/ui/button";
import {
  getFeaturedProducts,
  searchProducts,
} from "@/modules/catalog/catalog.service";
import { getCategoryTree } from "@/modules/categories/category.service";

export const dynamic = "force-dynamic";

const FEATURES = [
  { title: "Catálogo genérico", description: "Tipos de produto configuráveis." },
  { title: "Variantes por atributos", description: "Cor/Tamanho, RAM/Storage." },
  { title: "Estoque por variante", description: "Reservas e auditoria." },
  { title: "Checkout idempotente", description: "Sem pedidos duplicados." },
  { title: "Pagamentos plugáveis", description: "Troque o provedor." },
  { title: "Admin completo", description: "Catálogo, pedidos e cupons." },
];

export default async function HomePage() {
  const [featured, latest, categories] = await Promise.all([
    getFeaturedProducts(8),
    searchProducts({ sort: "newest", pageSize: 8 }),
    getCategoryTree(),
  ]);

  return (
    <div className="flex flex-col">
      <section className="bg-muted/40 border-b">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div className="space-y-5">
            <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              E-commerce Core
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              E-commerce modular para qualquer segmento
            </h1>
            <p className="text-muted-foreground max-w-md text-base">
              Catálogo, variantes, estoque e checkout desacoplados do tipo de
              produto.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" render={<Link href="/produtos" />}>
                Ver a demonstração
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<Link href="/categorias/eletronicos" />}
              >
                Ver eletrônicos
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categories.slice(0, 4).map((node) => (
              <Link
                key={node.category.slug}
                href={`/categorias/${node.category.slug}`}
                className="bg-background hover:border-foreground/30 rounded-lg border p-5 transition-colors"
              >
                <p className="font-semibold">{node.category.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="bg-background rounded-lg border p-5">
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/40 border-y">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-12 md:grid-cols-2">
          <Link
            href="/categorias/camisetas"
            className="bg-background hover:border-foreground/30 rounded-lg border p-6 transition-colors"
          >
            <p className="text-muted-foreground text-xs uppercase">Vestuário</p>
            <p className="mt-1 font-semibold">Camiseta — Cor × Tamanho</p>
          </Link>
          <Link
            href="/produtos/notebook-pro-14"
            className="bg-background hover:border-foreground/30 rounded-lg border p-6 transition-colors"
          >
            <p className="text-muted-foreground text-xs uppercase">Eletrônicos</p>
            <p className="mt-1 font-semibold">Notebook — RAM × Armazenamento</p>
          </Link>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Destaques</h2>
            <Button variant="link" render={<Link href="/produtos" />}>
              Ver tudo
            </Button>
          </div>
          <ProductGrid products={featured} />
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-7xl px-4 pb-16">
        <h2 className="mb-6 text-xl font-semibold tracking-tight">Categorias</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((node) => (
            <Link
              key={node.category.slug}
              href={`/categorias/${node.category.slug}`}
              className="hover:bg-muted/60 rounded-lg border p-5 transition-colors"
            >
              <p className="font-medium">{node.category.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-20">
        <h2 className="mb-6 text-xl font-semibold tracking-tight">Novidades</h2>
        <ProductGrid products={latest.items} />
      </section>
    </div>
  );
}
