import type { Metadata } from "next";

import { CatalogView, type CatalogSearchParams } from "@/components/catalog/catalog-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  return {
    title: query ? `Busca: ${query}` : "Busca",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  return (
    <CatalogView
      searchParams={params}
      title={query ? `Resultados para "${query}"` : "Busca"}
      description="Busque por nome, descrição ou atributos."
    />
  );
}
