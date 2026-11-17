import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Truck } from "lucide-react";

import { ProductGrid } from "@/components/product/product-grid";
import { Button } from "@/components/ui/button";
import { getFeaturedProducts, searchProducts } from "@/modules/catalog/catalog.service";
import { getCategoryTree } from "@/modules/categories/category.service";
import { getStoreAppearance } from "@/modules/settings/appearance";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, latest, categories, appearance] = await Promise.all([
    getFeaturedProducts(8),
    searchProducts({ sort: "newest", pageSize: 8 }),
    getCategoryTree(),
    getStoreAppearance(),
  ]);

  return (
    <div className="flex flex-col">
      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute -right-36 -top-48 size-[35rem] rounded-full bg-[var(--brand-accent)] opacity-20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-52 left-1/4 size-[28rem] rounded-full bg-background opacity-10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.12fr_0.88fr] md:items-center md:gap-16 md:px-8 md:py-24">
          <div className="max-w-2xl space-y-6">
            <p className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.21em]">
              <span className="h-1 w-10 rounded-full bg-[var(--brand-accent)]" aria-hidden="true" />
              <span>{appearance.name}</span>
            </p>
            <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              {appearance.tagline}
            </h1>
            <p className="max-w-lg text-base leading-relaxed opacity-85 sm:text-lg">
              Descubra nossos produtos, explore as novidades e encontre suas próximas escolhas favoritas.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Button size="lg" className="border border-transparent bg-[var(--brand-accent)] font-bold text-[var(--brand-accent-foreground)] hover:brightness-95" render={<Link href="/produtos" />}>
                Explorar produtos <ArrowRight className="size-4" />
              </Button>
              {categories[0] ? (
                <Button size="lg" variant="outline" className="border-current bg-transparent text-inherit hover:bg-background/15 hover:text-inherit" render={<Link href={`/categorias/${categories[0].category.slug}`} />}>
                  Ver categorias
                </Button>
              ) : null}
            </div>
          </div>
          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-2xl border border-current/15 bg-background/10 px-6 py-10 shadow-xl backdrop-blur-sm md:min-h-80 md:p-12">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-[var(--brand-accent)]" aria-hidden="true" />
            <div className="flex flex-col items-center gap-5 text-center">
              {appearance.logoUrl ? (
                <div className="flex min-h-36 min-w-44 items-center justify-center rounded-xl bg-white px-6 py-5 shadow-lg sm:min-h-44 sm:min-w-56">
                  <img src={appearance.logoUrl} alt={`Logotipo de ${appearance.name}`} className="max-h-36 w-auto max-w-56 object-contain" />
                </div>
              ) : (
                <span className="flex size-24 items-center justify-center rounded-2xl bg-[var(--brand-accent)] text-5xl font-black text-[var(--brand-accent-foreground)] shadow-lg">
                  {appearance.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <p className="text-2xl font-bold tracking-tight sm:text-3xl">{appearance.name}</p>
              <span className="h-1 w-16 rounded-full bg-[var(--brand-accent)]" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-primary/15 bg-primary/[0.055]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-5 py-5 text-sm font-medium sm:grid-cols-3 md:px-8">
          <p className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> Compra com segurança</p>
          <p className="flex items-center gap-2"><Truck className="size-5 text-primary" /> Consulte opções de entrega</p>
          <p className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Produtos selecionados</p>
        </div>
      </div>

      {categories.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">Descubra</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Compre por categoria</h2>
            </div>
            <Link href="/produtos" className="text-sm font-semibold text-primary hover:underline">Ver catálogo <ArrowRight className="inline size-4" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {categories.slice(0, 8).map((node, index) => (
              <Link key={node.category.slug} href={`/categorias/${node.category.slug}`} className="group relative flex min-h-40 items-end overflow-hidden rounded-xl border border-primary/15 bg-primary/[0.045] p-5 transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-md">
                <span className="absolute left-0 top-0 h-full w-1.5 bg-[var(--brand-accent)]" aria-hidden="true" />
                <span className="absolute right-4 top-3 text-5xl font-black text-primary/10" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="relative flex w-full items-center justify-between gap-2 text-base font-bold tracking-tight">
                  {node.category.name}<ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="border-y border-primary/10 bg-primary/[0.035]">
          <div className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><span className="size-2 rounded-full bg-[var(--brand-accent)]" /> Escolhas especiais</p>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Destaques</h2>
              </div>
              <Link href="/produtos" className="text-sm font-semibold text-primary hover:underline">Ver todos <ArrowRight className="inline size-4" /></Link>
            </div>
            <ProductGrid products={featured} />
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><span className="size-2 rounded-full bg-[var(--brand-accent)]" /> Acabaram de chegar</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Novidades</h2>
          </div>
          <Link href="/produtos?sort=newest" className="text-sm font-semibold text-primary hover:underline">Explorar catálogo <ArrowRight className="inline size-4" /></Link>
        </div>
        <ProductGrid products={latest.items} />
      </section>
    </div>
  );
}
