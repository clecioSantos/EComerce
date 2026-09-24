import "server-only";

import { cache } from "react";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/slug";

import {
  buildCategoryTree,
  getAncestors,
  type CategoryLike,
  type CategoryNode,
} from "./tree";

export const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(1).max(120).optional(),
  description: z.string().max(300).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  parentId: z.string().min(1).optional().nullable(),
  position: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// `cache` (React) deduplica a query dentro da mesma requisição — a home e o
// header chamam `getCategoryTree` na mesma renderização.
export const listCategories = cache(async (): Promise<CategoryLike[]> => {
  const categories = await prisma.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      position: true,
    },
  });
  return categories;
});

export const getCategoryTree = cache(
  async (): Promise<CategoryNode<CategoryLike>[]> =>
    buildCategoryTree(await listCategories()),
);

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export async function getCategoryBreadcrumb(slug: string) {
  const category = await getCategoryBySlug(slug);
  if (!category) return null;

  const all = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, parentId: true, position: true },
  });

  return {
    category,
    ancestors: getAncestors(all, category.id),
  };
}

async function resolveCategorySlug(name: string, desired?: string | null) {
  const base = slugify(desired && desired.length > 0 ? desired : name);
  let candidate = base;
  let counter = 1;
  for (;;) {
    const existing = await prisma.category.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

export async function createCategory(input: CreateCategoryInput) {
  const slug = await resolveCategorySlug(input.name, input.slug);
  return prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      parentId: input.parentId ?? null,
      position: input.position,
      isActive: input.isActive,
    },
  });
}
