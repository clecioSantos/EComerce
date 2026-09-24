import type { Metadata } from "next";

import {
  CatalogView,
  type CatalogSearchParams,
} from "@/components/catalog/catalog-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catálogo",
  description:
    "Demonstração do catálogo genérico: produtos, variantes e filtros por atributos.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  return (
    <CatalogView
      searchParams={params}
      title="Catálogo"
      description="Demonstração do catálogo genérico."
    />
  );
}
