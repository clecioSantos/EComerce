import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogView, type CatalogSearchParams } from "@/components/catalog/catalog-view";
import { getCategoryBySlug } from "@/modules/categories/category.service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Categoria" };

  return {
    title: category.name,
    description: category.description ?? `Produtos da categoria ${category.name}.`,
    alternates: { canonical: `/categorias/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <CatalogView
      searchParams={sp}
      categorySlug={category.slug}
      title={category.name}
      description={category.description ?? undefined}
    />
  );
}
