import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/slug";

import type { ProductTypeDTO, AttributeDTO, AttributeValueDTO } from "@/modules/products/types";
import type {
  CreateAttributeInput,
  CreateProductTypeInput,
} from "@/modules/products/schemas";

export const productTypeInclude = {
  attributes: {
    orderBy: { position: "asc" },
    include: { values: { orderBy: { position: "asc" } } },
  },
} satisfies Prisma.ProductTypeInclude;

type ProductTypeWithAttributes = Prisma.ProductTypeGetPayload<{
  include: typeof productTypeInclude;
}>;

export function mapProductType(productType: ProductTypeWithAttributes): ProductTypeDTO {
  const attributes: AttributeDTO[] = productType.attributes.map((attribute) => {
    const values: AttributeValueDTO[] = attribute.values.map((value) => ({
      id: value.id,
      attributeId: value.attributeId,
      value: value.value,
      slug: value.slug,
      position: value.position,
    }));
    return {
      id: attribute.id,
      name: attribute.name,
      slug: attribute.slug,
      type: attribute.type,
      unit: attribute.unit,
      isRequired: attribute.isRequired,
      allowMultiple: attribute.allowMultiple,
      isFilterable: attribute.isFilterable,
      isVariantDefining: attribute.isVariantDefining,
      position: attribute.position,
      values,
    };
  });

  return {
    id: productType.id,
    name: productType.name,
    slug: productType.slug,
    description: productType.description,
    icon: productType.icon,
    isActive: productType.isActive,
    attributes,
  };
}

export async function listProductTypes(): Promise<ProductTypeDTO[]> {
  const productTypes = await prisma.productType.findMany({
    include: productTypeInclude,
    orderBy: { name: "asc" },
  });
  return productTypes.map(mapProductType);
}

export async function getProductTypeBySlug(
  slug: string,
): Promise<ProductTypeDTO | null> {
  const productType = await prisma.productType.findUnique({
    where: { slug },
    include: productTypeInclude,
  });
  return productType ? mapProductType(productType) : null;
}

async function resolveSlug(
  model: "productType" | "productAttribute",
  name: string,
  desired?: string | null,
  scope?: { productTypeId: string },
): Promise<string> {
  const base = slugify(desired && desired.length > 0 ? desired : name);
  let candidate = base;
  let counter = 1;

  for (;;) {
    const existing =
      model === "productType"
        ? await prisma.productType.findUnique({
            where: { slug: candidate },
            select: { id: true },
          })
        : await prisma.productAttribute.findFirst({
            where: {
              productTypeId: scope?.productTypeId,
              slug: candidate,
            },
            select: { id: true },
          });
    if (!existing) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

export async function createProductType(input: CreateProductTypeInput) {
  const slug = await resolveSlug("productType", input.name, input.slug);

  return prisma.productType.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      icon: input.icon ?? null,
      isActive: input.isActive,
      attributes: {
        create: input.attributes.map((attribute, index) => ({
          name: attribute.name,
          slug: slugify(attribute.slug || attribute.name),
          type: attribute.type,
          description: attribute.description ?? null,
          unit: attribute.unit ?? null,
          isRequired: attribute.isRequired,
          allowMultiple: attribute.allowMultiple,
          isFilterable: attribute.isFilterable,
          isVariantDefining: attribute.isVariantDefining,
          position: attribute.position ?? index,
          values: {
            create: attribute.values.map((value, valueIndex) => ({
              value: value.value,
              slug: slugify(value.slug || value.value),
              position: value.position ?? valueIndex,
            })),
          },
        })),
      },
    },
    include: productTypeInclude,
  });
}

export async function createAttribute(input: CreateAttributeInput) {
  const slug = await resolveSlug(
    "productAttribute",
    input.name,
    input.slug,
    { productTypeId: input.productTypeId },
  );

  return prisma.productAttribute.create({
    data: {
      productTypeId: input.productTypeId,
      name: input.name,
      slug,
      type: input.type,
      description: input.description ?? null,
      unit: input.unit ?? null,
      isRequired: input.isRequired,
      allowMultiple: input.allowMultiple,
      isFilterable: input.isFilterable,
      isVariantDefining: input.isVariantDefining,
      position: input.position,
      values: {
        create: input.values.map((value, index) => ({
          value: value.value,
          slug: slugify(value.slug || value.value),
          position: value.position ?? index,
        })),
      },
    },
    include: { values: true },
  });
}
