import Image from "next/image";
import Link from "next/link";

import { ProductGrid } from "@/components/product/product-grid";
import { Button } from "@/components/ui/button";
import { getFeaturedProducts, searchProducts } from "@/modules/catalog/catalog.service";
import { getCategoryTree } from "@/modules/categories/category.service";
import { getStoreAppearance } from "@/modules/settings/appearance";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, latest, categories, appearance] = await Promise.all([
    getFeaturedProducts(4),
    searchProducts({ sort: "newest", pageSize: 8 }),
    getCategoryTree(),
    getStoreAppearance(),
  ]);
  const hero = [...featured, ...latest.items].find((product) => product.image);
  // Each category uses a photo from its own catalog, including descendants.
  const collections = await Promise.all(
    categories.slice(0, 4).map(async (node) => {
      const products = await searchProducts({
        categorySlug: node.category.slug,
        pageSize: 1,
      });
      return { category: node.category, image: products.items[0]?.image };
    }),
  );
  const featuredIds = new Set(featured.map((product) => product.id));
  const arrivals = latest.items
    .filter((product) => !featuredIds.has(product.id))
    .slice(0, 4);

  return (
    <div>
      <section
        className={`bg-primary/[0.04] grid md:min-h-[36rem] ${hero ? "md:grid-cols-2" : ""}`}
      >
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 md:py-20 lg:pr-16 lg:pl-[max(3rem,calc((100vw-80rem)/2+2rem))]">
          <p className="text-primary mb-7 text-sm font-medium tracking-[0.22em] uppercase">
            {appearance.name}
          </p>
          <h1 className="max-w-xl font-serif text-4xl leading-[1.12] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {appearance.tagline}
          </h1>
          <p className="text-muted-foreground mt-6 max-w-md text-base leading-relaxed">
            Explore as categorias, veja os detalhes e encontre o que combina com você.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Button
              size="lg"
              className="rounded-none px-7"
              render={<Link href="/produtos" />}
            >
              Conhecer o catálogo
            </Button>
            <Link
              href="/produtos?sort=newest"
              className="text-sm underline underline-offset-8"
            >
              Ver novidades
            </Link>
          </div>
        </div>
        {hero?.image ? (
          <Link
            href={`/produtos/${hero.slug}`}
            className="group bg-muted relative block aspect-[4/5] overflow-hidden md:aspect-auto md:min-h-[36rem]"
            aria-label={`Conhecer ${hero.name}`}
          >
            <Image
              src={hero.image}
              alt={hero.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              loading="eager"
              className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.025]"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/70 to-transparent px-6 pt-20 pb-6 text-white sm:px-10">
              <span>
                <span className="mb-2 block text-xs tracking-widest uppercase">
                  Em destaque
                </span>
                <span className="text-lg font-medium">{hero.name}</span>
              </span>
              <span className="shrink-0 text-sm underline underline-offset-4">
                Ver produto
              </span>
            </span>
          </Link>
        ) : null}
      </section>

      {collections.length > 0 ? (
        <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground mb-3 text-xs tracking-[0.2em] uppercase">
                O catálogo, por você
              </p>
              <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
                Explore por categoria
              </h2>
            </div>
            <Link href="/produtos" className="text-sm underline underline-offset-4">
              Ver tudo
            </Link>
          </div>
          <div
            className={`grid grid-cols-2 gap-x-4 gap-y-7 md:gap-6 ${collections.length > 2 ? "md:grid-cols-4" : ""}`}
          >
            {collections.map(({ category, image }) => (
              <Link
                key={category.slug}
                href={`/categorias/${category.slug}`}
                className="group block outline-offset-4 focus-visible:outline-2"
              >
                <div className="bg-muted relative aspect-[3/4] overflow-hidden">
                  {image ? (
                    <Image
                      src={image}
                      alt={`Explore ${category.name}`}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.035]"
                    />
                  ) : (
                    <span className="text-muted-foreground flex h-full items-center justify-center p-4 text-center font-serif text-xl">
                      {category.name}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-base font-medium underline-offset-4 group-hover:underline">
                  {category.name}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {featured.length > 0 ? (
        <section className="bg-muted/25 border-y">
          <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-muted-foreground mb-3 text-xs tracking-[0.2em] uppercase">
                  Uma seleção da loja
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl">Em destaque</h2>
              </div>
              <Link href="/produtos" className="text-sm underline underline-offset-4">
                Ver catálogo
              </Link>
            </div>
            <ProductGrid products={featured} />
          </div>
        </section>
      ) : null}

      {arrivals.length > 0 ? (
        <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground mb-3 text-xs tracking-[0.2em] uppercase">
                Para descobrir agora
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl">Novidades no catálogo</h2>
            </div>
            <Link
              href="/produtos?sort=newest"
              className="text-sm underline underline-offset-4"
            >
              Todas as novidades
            </Link>
          </div>
          <ProductGrid products={arrivals} />
        </section>
      ) : null}
    </div>
  );
}
