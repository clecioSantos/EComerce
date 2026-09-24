import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getDescendantIds } from "@/modules/categories/tree";

import {
  mapProductSummary,
  productSummaryInclude,
} from "@/modules/products/product.service";
import type { ProductSummaryDTO } from "@/modules/products/types";

export interface CatalogFilters {
  query?: string;
  categorySlug?: string;
  productTypeSlug?: string;
  brandSlug?: string;
  /** Mapa slug-do-atributo -> ids de valores selecionados. */
  attributeFilters?: Record<string, string[]>;
  minPrice?: number;
  maxPrice?: number;
  featuredOnly?: boolean;
  sort?: "relevance" | "newest" | "price-asc" | "price-desc";
  page?: number;
  pageSize?: number;
}

export interface CatalogResult {
  items: ProductSummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function buildOrderBy(
  sort: CatalogFilters["sort"],
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }];
    case "price-asc":
      return [{ basePrice: "asc" }];
    case "price-desc":
      return [{ basePrice: "desc" }];
    case "relevance":
    default:
      return [{ isFeatured: "desc" }, { createdAt: "desc" }];
  }
}

function buildAttributeWhere(
  attributeFilters?: Record<string, string[]>,
): Prisma.ProductWhereInput[] {
  if (!attributeFilters) return [];

  const conditions: Prisma.ProductWhereInput[] = [];
  for (const [attributeSlug, valueIds] of Object.entries(attributeFilters)) {
    if (valueIds.length === 0) continue;
    conditions.push({
      variants: {
        some: {
          attributes: {
            some: {
              attributeValueId: { in: valueIds },
              attribute: { slug: attributeSlug },
            },
          },
        },
      },
    });
  }
  return conditions;
}

/**
 * Resolve o slug de uma categoria para a lista de ids dela + descendentes,
 * para que páginas de categorias "pai" (Moda, Eletrônicos) mostrem também os
 * produtos das subcategorias.
 */
async function resolveCategoryIds(slug: string): Promise<string[] | null> {
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true, position: true, name: true },
  });
  const target = categories.find((category) => category.slug === slug);
  if (!target) return null;
  return [target.id, ...getDescendantIds(categories, target.id)];
}

export async function searchProducts(
  filters: CatalogFilters = {},
): Promise<CatalogResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? 12));

  const and: Prisma.ProductWhereInput[] = [{ status: "ACTIVE" }];

  if (filters.categorySlug) {
    const categoryIds = await resolveCategoryIds(filters.categorySlug);
    // Categoria inexistente -> nenhum resultado.
    and.push({ categoryId: { in: categoryIds ?? [] } });
  }
  if (filters.productTypeSlug) {
    and.push({ productType: { slug: filters.productTypeSlug } });
  }
  if (filters.brandSlug) {
    and.push({ brand: { slug: filters.brandSlug } });
  }
  if (filters.featuredOnly) {
    and.push({ isFeatured: true });
  }
  if (typeof filters.minPrice === "number") {
    and.push({ basePrice: { gte: filters.minPrice } });
  }
  if (typeof filters.maxPrice === "number") {
    and.push({ basePrice: { lte: filters.maxPrice } });
  }
  if (filters.query && filters.query.trim().length > 0) {
    const term = filters.query.trim();
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { shortDescription: { contains: term, mode: "insensitive" } },
      ],
    });
  }
  and.push(...buildAttributeWhere(filters.attributeFilters));

  const where: Prisma.ProductWhereInput = { AND: and };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productSummaryInclude,
      orderBy: buildOrderBy(filters.sort),
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map(mapProductSummary),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface FacetValue {
  id: string;
  value: string;
  slug: string;
}

export interface Facet {
  attributeId: string;
  name: string;
  slug: string;
  values: FacetValue[];
}

export interface CatalogFacets {
  attributes: Facet[];
  priceRange: { min: number; max: number };
}

/** Facetas de filtro são derivadas dos atributos marcados como filtráveis. */
export async function getCatalogFacets(params: {
  productTypeSlug?: string;
  categorySlug?: string;
}): Promise<CatalogFacets> {
  const productType = params.productTypeSlug
    ? await prisma.productType.findUnique({
        where: { slug: params.productTypeSlug },
        include: {
          attributes: {
            where: { isFilterable: true },
            orderBy: { position: "asc" },
            include: { values: { orderBy: { position: "asc" } } },
          },
        },
      })
    : null;

  const categoryIds = params.categorySlug
    ? await resolveCategoryIds(params.categorySlug)
    : null;

  const priceAggregate = await prisma.product.aggregate({
    where: {
      status: "ACTIVE",
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(params.productTypeSlug
        ? { productType: { slug: params.productTypeSlug } }
        : {}),
    },
    _min: { basePrice: true },
    _max: { basePrice: true },
  });

  const attributes: Facet[] =
    productType?.attributes.map((attribute) => ({
      attributeId: attribute.id,
      name: attribute.name,
      slug: attribute.slug,
      values: attribute.values.map((value) => ({
        id: value.id,
        value: value.value,
        slug: value.slug,
      })),
    })) ?? [];

  return {
    attributes,
    priceRange: {
      min: priceAggregate._min.basePrice
        ? Number(priceAggregate._min.basePrice)
        : 0,
      max: priceAggregate._max.basePrice
        ? Number(priceAggregate._max.basePrice)
        : 0,
    },
  };
}

export async function getFeaturedProducts(
  limit = 8,
): Promise<ProductSummaryDTO[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", isFeatured: true },
    include: productSummaryInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(mapProductSummary);
}

export async function getRelatedProducts(params: {
  productId: string;
  categoryId?: string | null;
  limit?: number;
}): Promise<ProductSummaryDTO[]> {
  const { productId, categoryId, limit = 4 } = params;
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      id: { not: productId },
      ...(categoryId ? { categoryId } : {}),
    },
    include: productSummaryInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(mapProductSummary);
}
