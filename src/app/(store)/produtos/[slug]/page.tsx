import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductGallery } from "@/components/product/product-gallery";
import { ProductGrid } from "@/components/product/product-grid";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getRelatedProducts } from "@/modules/catalog/catalog.service";
import { getProductBySlug } from "@/modules/products/product.service";
import { getProductRating, listProductReviews } from "@/modules/reviews/review.service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };

  return {
    title: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    alternates: { canonical: `/produtos/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.shortDescription ?? undefined,
      type: "website",
      images: product.image ? [{ url: product.image }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [reviews, rating, related] = await Promise.all([
    listProductReviews(product.id),
    getProductRating(product.id),
    getRelatedProducts({
      productId: product.id,
      categoryId: product.category?.id ?? null,
      limit: 4,
    }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    image: product.images.map((image) => image.url),
    sku: product.variants[0]?.sku,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.currency,
      lowPrice: Math.min(...product.variants.map((variant) => variant.price)),
      highPrice: Math.max(...product.variants.map((variant) => variant.price)),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-muted-foreground mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/" className="hover:text-foreground">
          Início
        </Link>
        <span>/</span>
        <Link href="/produtos" className="hover:text-foreground">
          Produtos
        </Link>
        {product.category ? (
          <>
            <span>/</span>
            <Link
              href={`/categorias/${product.category.slug}`}
              className="hover:text-foreground"
            >
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} title={product.name} />

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{product.productType.name}</Badge>
              {product.brand ? (
                <span className="text-muted-foreground text-sm">
                  {product.brand.name}
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {rating.count > 0 ? (
              <p className="text-muted-foreground text-sm">
                {rating.average.toFixed(1)} / 5 · {rating.count} avaliação(ões)
              </p>
            ) : null}
          </div>

          <PurchasePanel product={product} />

          <Separator />

          {product.description ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Descrição</h2>
              <p className="text-muted-foreground text-sm whitespace-pre-line">
                {product.description}
              </p>
            </div>
          ) : null}

          {product.assignments.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Especificações</h2>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {product.assignments.map((assignment) => (
                  <div key={assignment.attributeId} className="flex flex-col">
                    <dt className="text-muted-foreground text-xs">
                      {assignment.attributeName}
                    </dt>
                    <dd>{assignment.value ?? "-"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      {reviews.length > 0 ? (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            Avaliações
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{review.authorName}</p>
                  <span className="text-sm">{"★".repeat(review.rating)}</span>
                </div>
                {review.title ? (
                  <p className="mt-1 text-sm font-medium">{review.title}</p>
                ) : null}
                {review.comment ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {review.comment}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            Você também pode gostar
          </h2>
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  );
}
