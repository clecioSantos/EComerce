import Link from "next/link";
import { ArrowRight, ShieldCheck, ShoppingBag, Sparkles, Truck } from "lucide-react";

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
      <section className="relative overflow-hidden border-b bg-[#f7f6f3] text-[#1d2933]">
        <div className="pointer-events-none absolute -right-28 top-8 size-80 rounded-full bg-[var(--brand-accent)] opacity-10 blur-3xl md:size-[34rem]" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-center md:px-8 md:py-24">
          <div className="max-w-2xl space-y-6">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#57616a]">
              <span className="h-px w-7 bg-[var(--brand-accent)]" /> Novidades e favoritos
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              {appearance.tagline}
            </h1>
            <p className="max-w-md text-base leading-relaxed text-[#626a71]">
              Conheça nossa seleção de produtos e encontre o que você procura, com uma experiência de compra simples e segura.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" render={<Link href="/produtos" />}>Explorar produtos <ArrowRight className="size-4" /></Button>
              {categories[0] ? <Button size="lg" variant="outline" render={<Link href={`/categorias/${categories[0].category.slug}`} />}>Ver categorias</Button> : null}
            </div>
          </div>
          <div className="relative hidden min-h-64 items-center justify-center rounded-sm border border-[#e4e0d9] bg-white/65 p-8 md:flex">
            <div className="absolute left-5 top-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a817f]">Sua loja, seu estilo</div>
            <div className="space-y-5 text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-sm bg-[var(--brand-accent)]/20"><ShoppingBag className="size-9 text-[#45515a]" strokeWidth={1.4} /></div>
              <p className="text-xl font-semibold tracking-tight">{appearance.name}</p>
              <p className="text-sm text-[#6c757c]">Uma experiência feita para você.</p>
            </div>
            <div className="absolute bottom-5 right-5 h-1 w-16 bg-[var(--brand-accent)]" />
          </div>
        </div>
      </section>

      <div className="border-b">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-5 py-5 text-xs text-muted-foreground sm:grid-cols-3 md:px-8">
          <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-foreground" /> Compra com segurança</p>
          <p className="flex items-center gap-2"><Truck className="size-4 text-foreground" /> Consulte opções de entrega</p>
          <p className="flex items-center gap-2"><Sparkles className="size-4 text-foreground" /> Produtos selecionados</p>
        </div>
      </div>

      {categories.length > 0 && <section className="mx-auto w-full max-w-7xl px-5 py-14 md:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Descubra</p><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Compre por categoria</h2></div>
          <Link href="/produtos" className="text-sm font-medium hover:underline">Ver catálogo <ArrowRight className="inline size-4" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categories.slice(0,8).map(node=><Link key={node.category.slug} href={`/categorias/${node.category.slug}`} className="group flex min-h-32 items-end rounded-sm border bg-muted/35 p-5 transition-colors hover:border-primary hover:bg-muted/60"><span className="font-medium tracking-tight group-hover:underline">{node.category.name}</span></Link>)}
        </div>
      </section>}

      {featured.length > 0 && <section className="border-y bg-muted/20">
        <div className="mx-auto w-full max-w-7xl px-5 py-14 md:px-8">
          <div className="mb-7 flex items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Escolhas especiais</p><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Destaques</h2></div><Link href="/produtos" className="text-sm font-medium hover:underline">Ver todos <ArrowRight className="inline size-4" /></Link></div>
          <ProductGrid products={featured} />
        </div>
      </section>}

      <section className="mx-auto w-full max-w-7xl px-5 py-14 md:px-8">
        <div className="mb-7 flex items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Acabaram de chegar</p><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Novidades</h2></div><Link href="/produtos?sort=newest" className="text-sm font-medium hover:underline">Explorar catálogo <ArrowRight className="inline size-4" /></Link></div>
        <ProductGrid products={latest.items} />
      </section>
    </div>
  );
}
