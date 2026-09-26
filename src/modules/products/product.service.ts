import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { ProductStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/slug";

import type {
  CreateProductInput,
  ProductVariantInput,
  UpdateProductInput,
  VariantLogisticsInput,
} from "./schemas";
import { variantSignature } from "./variant";
import type {
  ProductAssignmentDTO,
  ProductDetailDTO,
  ProductImageDTO,
  ProductSummaryDTO,
  VariantAttributeDTO,
  VariantDTO,
} from "./types";

export const productDetailInclude = {
  productType: { include: { attributes: { include: { values: true } } } },
  category: true,
  brand: true,
  images: { orderBy: { position: "asc" } },
  assignments: {
    include: { attribute: true, attributeValue: true },
  },
  variants: {
    orderBy: { position: "asc" },
    include: {
      inventory: true,
      images: { orderBy: { position: "asc" } },
      attributes: {
        include: { attribute: true, attributeValue: true },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithDetail = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

export const productSummaryInclude = {
  category: true,
  productType: true,
  images: { orderBy: { position: "asc" } },
  variants: { include: { inventory: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithSummary = Prisma.ProductGetPayload<{
  include: typeof productSummaryInclude;
}>;

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

function primaryImage(
  images: { url: string; isPrimary: boolean; position: number }[],
): string | null {
  if (images.length === 0) return null;
  const primary = images.find((image) => image.isPrimary);
  return (primary ?? images[0]).url;
}

function hasStock(
  variants: {
    inventory: {
      quantityOnHand: number;
      quantityReserved: number;
      allowBackorder: boolean;
    } | null;
  }[],
): boolean {
  return variants.some((variant) => {
    if (!variant.inventory) return false;
    if (variant.inventory.allowBackorder) return true;
    return variant.inventory.quantityOnHand - variant.inventory.quantityReserved > 0;
  });
}

export function mapProductSummary(product: ProductWithSummary): ProductSummaryDTO {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    status: product.status,
    basePrice: toNumber(product.basePrice),
    compareAtPrice:
      product.compareAtPrice == null ? null : toNumber(product.compareAtPrice),
    currency: product.currency,
    isFeatured: product.isFeatured,
    image: primaryImage(product.images),
    categoryName: product.category?.name ?? null,
    categorySlug: product.category?.slug ?? null,
    productTypeSlug: product.productType.slug,
    inStock: hasStock(product.variants),
    createdAt: product.createdAt.toISOString(),
  };
}

export function mapProductDetail(product: ProductWithDetail): ProductDetailDTO {
  const images: ProductImageDTO[] = product.images.map((image) => ({
    id: image.id,
    url: image.url,
    alt: image.alt,
    position: image.position,
    isPrimary: image.isPrimary,
    variantId: image.variantId,
  }));

  const variants: VariantDTO[] = product.variants.map((variant) => {
    const attributes: VariantAttributeDTO[] = variant.attributes.map((link) => ({
      attributeId: link.attributeId,
      attributeName: link.attribute.name,
      attributeSlug: link.attribute.slug,
      attributeType: link.attribute.type,
      valueId: link.attributeValueId,
      value: link.attributeValue.value,
      valueSlug: link.attributeValue.slug,
    }));

    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      name: variant.name,
      price:
        variant.price == null ? toNumber(product.basePrice) : toNumber(variant.price),
      compareAtPrice:
        variant.compareAtPrice == null ? null : toNumber(variant.compareAtPrice),
      weight: variant.weight == null ? null : toNumber(variant.weight),
      width: variant.width == null ? null : toNumber(variant.width),
      height: variant.height == null ? null : toNumber(variant.height),
      length: variant.length == null ? null : toNumber(variant.length),
      isActive: variant.isActive,
      position: variant.position,
      attributes,
      inventory: variant.inventory
        ? {
            id: variant.inventory.id,
            quantityOnHand: variant.inventory.quantityOnHand,
            quantityReserved: variant.inventory.quantityReserved,
            available:
              variant.inventory.quantityOnHand - variant.inventory.quantityReserved,
            reorderLevel: variant.inventory.reorderLevel,
            allowBackorder: variant.inventory.allowBackorder,
          }
        : null,
      image: primaryImage(variant.images),
    };
  });

  const assignments: ProductAssignmentDTO[] = product.assignments.map((assignment) => ({
    attributeId: assignment.attributeId,
    attributeName: assignment.attribute.name,
    attributeSlug: assignment.attribute.slug,
    attributeType: assignment.attribute.type,
    valueId: assignment.attributeValueId,
    value: assignment.attributeValue?.value ?? null,
    raw: assignment.value,
  }));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    status: product.status,
    basePrice: toNumber(product.basePrice),
    compareAtPrice:
      product.compareAtPrice == null ? null : toNumber(product.compareAtPrice),
    currency: product.currency,
    isFeatured: product.isFeatured,
    image: primaryImage(product.images),
    categoryName: product.category?.name ?? null,
    categorySlug: product.category?.slug ?? null,
    productTypeSlug: product.productType.slug,
    inStock: hasStock(product.variants),
    createdAt: product.createdAt.toISOString(),
    productType: {
      id: product.productType.id,
      name: product.productType.name,
      slug: product.productType.slug,
    },
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug,
        }
      : null,
    brand: product.brand
      ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug }
      : null,
    images,
    variants,
    assignments,
    metadata: (product.metadata as Record<string, unknown> | null) ?? null,
  };
}

async function resolveProductSlug(
  name: string,
  desired?: string | null,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired && desired.length > 0 ? desired : name);
  let candidate = base;
  let counter = 1;
  for (;;) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

async function resolveVariantAttributes(
  productTypeId: string,
  variants: ProductVariantInput[],
) {
  const valueIds = [...new Set(variants.flatMap((variant) => variant.attributeValueIds))];
  if (valueIds.length === 0) return new Map<string, string>();

  const values = await prisma.productAttributeValue.findMany({
    where: { id: { in: valueIds } },
    include: { attribute: { select: { id: true, productTypeId: true } } },
  });

  if (values.length !== valueIds.length) {
    throw new Error("Um ou mais valores de atributo de variante não existem.");
  }

  const valueToAttribute = new Map<string, string>();
  for (const value of values) {
    if (value.attribute.productTypeId !== productTypeId) {
      throw new Error(
        `Valor de atributo "${value.value}" não pertence ao tipo de produto informado.`,
      );
    }
    valueToAttribute.set(value.id, value.attributeId);
  }
  return valueToAttribute;
}

export async function createProduct(input: CreateProductInput) {
  const slug = await resolveProductSlug(input.name, input.slug);
  const valueToAttribute = await resolveVariantAttributes(
    input.productTypeId,
    input.variants,
  );

  // Proteção de integridade: a assinatura deve ser única por produto.
  const signatures = input.variants.map((variant) =>
    variantSignature(variant.attributeValueIds),
  );
  if (new Set(signatures).size !== signatures.length) {
    throw new Error(
      "Existem variantes com a mesma combinação de atributos neste produto.",
    );
  }

  return prisma.product.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      shortDescription: input.shortDescription ?? null,
      status: input.status,
      productTypeId: input.productTypeId,
      categoryId: input.categoryId ?? null,
      brandId: input.brandId ?? null,
      basePrice: input.basePrice,
      compareAtPrice: input.compareAtPrice ?? null,
      currency: input.currency,
      isFeatured: input.isFeatured,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      images: {
        create: input.images.map((image) => ({
          url: image.url,
          alt: image.alt ?? null,
          position: image.position,
          isPrimary: image.isPrimary,
        })),
      },
      assignments: {
        create: input.assignments.map((assignment) => ({
          attributeId: assignment.attributeId,
          attributeValueId: assignment.attributeValueId ?? null,
          value: (assignment.value ?? undefined) as Prisma.InputJsonValue | undefined,
        })),
      },
      variants: {
        create: input.variants.map((variant, index) => ({
          sku: variant.sku,
          signature: variantSignature(variant.attributeValueIds),
          name: variant.name ?? null,
          price: variant.price ?? null,
          compareAtPrice: variant.compareAtPrice ?? null,
          weight: variant.weight ?? null,
          width: variant.width ?? null,
          height: variant.height ?? null,
          length: variant.length ?? null,
          barcode: variant.barcode ?? null,
          position: variant.position ?? index,
          isActive: variant.isActive,
          attributes: {
            create: variant.attributeValueIds.map((valueId) => {
              const attributeId = valueToAttribute.get(valueId);
              if (!attributeId) {
                throw new Error(`Valor de atributo inválido: ${valueId}`);
              }
              return { attributeId, attributeValueId: valueId };
            }),
          },
          inventory: {
            create: {
              quantityOnHand: variant.inventory?.quantityOnHand ?? 0,
              reorderLevel: variant.inventory?.reorderLevel ?? 0,
              allowBackorder: variant.inventory?.allowBackorder ?? false,
            },
          },
        })),
      },
    },
    include: productDetailInclude,
  });
}

export interface AdminProductEditVariant {
  id: string;
  sku: string;
  name: string | null;
  price: number | null;
  compareAtPrice: number | null;
  weight: number | null;
  width: number | null;
  height: number | null;
  length: number | null;
  barcode: string | null;
  isActive: boolean;
}

export interface AdminProductEditDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  status: ProductStatus;
  categoryId: string | null;
  brandId: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  isFeatured: boolean;
  primaryImageUrl: string | null;
  variants: AdminProductEditVariant[];
}

/** Dados brutos do produto para o formulário de edição do admin. */
export async function getProductForEdit(id: string): Promise<AdminProductEditDTO | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { where: { variantId: null }, orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
    },
  });
  if (!product) return null;

  const primary =
    product.images.find((image) => image.isPrimary) ?? product.images[0] ?? null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    status: product.status,
    categoryId: product.categoryId,
    brandId: product.brandId,
    basePrice: toNumber(product.basePrice),
    compareAtPrice:
      product.compareAtPrice == null ? null : toNumber(product.compareAtPrice),
    isFeatured: product.isFeatured,
    primaryImageUrl: primary?.url ?? null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      price: variant.price == null ? null : toNumber(variant.price),
      compareAtPrice:
        variant.compareAtPrice == null ? null : toNumber(variant.compareAtPrice),
      weight: variant.weight == null ? null : toNumber(variant.weight),
      width: variant.width == null ? null : toNumber(variant.width),
      height: variant.height == null ? null : toNumber(variant.height),
      length: variant.length == null ? null : toNumber(variant.length),
      barcode: variant.barcode,
      isActive: variant.isActive,
    })),
  };
}

/**
 * Atualiza os dados básicos do produto e de suas variantes (preços, dados de
 * envio, SKU, status) e, opcionalmente, a imagem principal. Não altera a
 * composição de atributos/variantes.
 */
export async function updateProduct(input: UpdateProductInput) {
  const slug = await resolveProductSlug(input.name, input.slug, input.id);
  const primaryImageUrl =
    input.primaryImageUrl && input.primaryImageUrl.length > 0
      ? input.primaryImageUrl
      : null;

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: input.id },
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        shortDescription: input.shortDescription ?? null,
        status: input.status,
        categoryId: input.categoryId ?? null,
        brandId: input.brandId ?? null,
        basePrice: input.basePrice,
        compareAtPrice: input.compareAtPrice ?? null,
        isFeatured: input.isFeatured,
      },
    });

    for (const variant of input.variants) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          sku: variant.sku,
          name: variant.name ?? null,
          price: variant.price ?? null,
          compareAtPrice: variant.compareAtPrice ?? null,
          weight: variant.weight ?? null,
          width: variant.width ?? null,
          height: variant.height ?? null,
          length: variant.length ?? null,
          barcode: variant.barcode ?? null,
          isActive: variant.isActive,
        },
      });
    }

    // Somente imagens do produto (não as específicas de variante).
    await tx.productImage.deleteMany({
      where: { productId: input.id, variantId: null },
    });
    if (primaryImageUrl) {
      await tx.productImage.create({
        data: {
          productId: input.id,
          url: primaryImageUrl,
          alt: input.name,
          position: 0,
          isPrimary: true,
        },
      });
    }

    return product;
  });
}

export async function getProductBySlug(slug: string): Promise<ProductDetailDTO | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: productDetailInclude,
  });
  return product ? mapProductDetail(product) : null;
}

export async function getProductById(id: string): Promise<ProductDetailDTO | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productDetailInclude,
  });
  return product ? mapProductDetail(product) : null;
}

export interface ListProductsParams {
  status?: ProductStatus;
  productTypeId?: string;
  categoryId?: string;
  search?: string;
  take?: number;
  skip?: number;
  featuredOnly?: boolean;
}

export async function listProductSummaries(
  params: ListProductsParams = {},
): Promise<ProductSummaryDTO[]> {
  const { status = "ACTIVE", take = 24, skip = 0 } = params;

  const where: Prisma.ProductWhereInput = { status };

  if (params.productTypeId) where.productTypeId = params.productTypeId;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.featuredOnly) where.isFeatured = true;
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
      { shortDescription: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: productSummaryInclude,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take,
    skip,
  });

  return products.map(mapProductSummary);
}

export async function updateProductStatus(id: string, status: ProductStatus) {
  return prisma.product.update({ where: { id }, data: { status } });
}

/** Atualiza os dados logísticos (peso/dimensões) de uma variante existente. */
export async function updateVariantLogistics(input: VariantLogisticsInput) {
  return prisma.productVariant.update({
    where: { id: input.variantId },
    data: {
      weight: input.weight ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      length: input.length ?? null,
    },
  });
}

export async function deleteProduct(id: string) {
  const orderItems = await prisma.orderItem.count({ where: { productId: id } });
  if (orderItems > 0) {
    throw new Error(
      "Produto com histórico de pedidos não pode ser excluído. Arquive-o (status ARCHIVED).",
    );
  }

  const inventory = await prisma.inventory.findFirst({
    where: { variant: { productId: id } },
    select: { id: true },
  });
  if (inventory) {
    throw new Error(
      "Produto com estoque registrado não pode ser excluído. Arquive-o (status ARCHIVED).",
    );
  }

  return prisma.product.delete({ where: { id } });
}

export async function countProducts(status: ProductStatus = "ACTIVE") {
  return prisma.product.count({ where: { status } });
}
