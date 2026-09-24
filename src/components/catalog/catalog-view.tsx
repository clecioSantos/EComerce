import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { PaginationControls } from "@/components/catalog/pagination-controls";
import { ProductGrid } from "@/components/product/product-grid";
import {
  getCatalogFacets,
  searchProducts,
  type CatalogFilters as CatalogFiltersInput,
} from "@/modules/catalog/catalog.service";

export type CatalogSearchParams = Record<
  string,
  string | string[] | undefined
>;

function parseAttributeFilters(
  searchParams: CatalogSearchParams,
): Record<string, string[]> {
  const filters: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (!key.startsWith("attr_")) continue;
    const slug = key.replace("attr_", "");
    const raw = Array.isArray(value) ? value.join(",") : value;
    const ids = (raw ?? "").split(",").filter(Boolean);
    if (ids.length > 0) filters[slug] = ids;
  }
  return filters;
}

function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function CatalogView({
  searchParams,
  categorySlug,
  productTypeSlug,
  title,
  description,
}: {
  searchParams: CatalogSearchParams;
  categorySlug?: string;
  productTypeSlug?: string;
  title: string;
  description?: string;
}) {
  const query = asString(searchParams.q);
  const sortParam = asString(searchParams.sort) ?? "relevance";
  const sort = (
    ["relevance", "newest", "price-asc", "price-desc"].includes(sortParam)
      ? sortParam
      : "relevance"
  ) as CatalogFiltersInput["sort"];
  const page = Number(asString(searchParams.page) ?? "1") || 1;
  const attributeFilters = parseAttributeFilters(searchParams);

  const [facets, result] = await Promise.all([
    getCatalogFacets({ categorySlug, productTypeSlug }),
    searchProducts({
      query,
      categorySlug,
      productTypeSlug,
      sort,
      page,
      pageSize: 12,
      attributeFilters,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {result.total} produto(s) encontrado(s)
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <CatalogFilters facets={facets} />
        </aside>
        <div>
          <ProductGrid products={result.items} />
          <PaginationControls page={result.page} totalPages={result.totalPages} />
        </div>
      </div>
    </div>
  );
}
