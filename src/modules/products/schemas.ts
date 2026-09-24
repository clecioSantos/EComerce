import { z } from "zod";

export const attributeTypeSchema = z.enum([
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "DATE",
  "COLOR",
  "RANGE",
  "DIMENSION",
]);

export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

const slugField = z.string().min(1).max(160).optional();
const idField = z.string().min(1);

export const attributeValueInputSchema = z.object({
  value: z.string().min(1).max(120),
  slug: slugField,
  position: z.coerce.number().int().min(0).default(0),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const attributeBaseSchema = z.object({
  productTypeId: idField,
  name: z.string().min(1).max(80),
  slug: slugField,
  type: attributeTypeSchema.default("TEXT"),
  description: z.string().max(300).optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  isRequired: z.coerce.boolean().default(false),
  allowMultiple: z.coerce.boolean().default(false),
  isFilterable: z.coerce.boolean().default(false),
  isVariantDefining: z.coerce.boolean().default(false),
  position: z.coerce.number().int().min(0).default(0),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  values: z.array(attributeValueInputSchema).default([]),
});

export const createAttributeSchema = attributeBaseSchema.refine(
  (data) =>
    !data.allowMultiple ||
    data.type === "MULTI_SELECT" ||
    data.type === "SELECT",
  {
    message: "allowMultiple só faz sentido para SELECT ou MULTI_SELECT",
    path: ["allowMultiple"],
  },
);

export const createProductTypeSchema = z.object({
  name: z.string().min(2).max(80),
  slug: slugField,
  description: z.string().max(300).optional().nullable(),
  icon: z.string().max(40).optional().nullable(),
  isActive: z.coerce.boolean().default(true),
  attributes: z
    .array(attributeBaseSchema.omit({ productTypeId: true }))
    .default([]),
});

export const productAssignmentSchema = z.object({
  attributeId: idField,
  attributeValueId: idField.optional().nullable(),
  value: z.unknown().optional().nullable(),
});

export const productVariantInputSchema = z
  .object({
    sku: z.string().min(1).max(80),
    name: z.string().max(160).optional().nullable(),
    price: z.coerce.number().min(0).optional().nullable(),
    compareAtPrice: z.coerce.number().min(0).optional().nullable(),
    weight: z.coerce.number().min(0).optional().nullable(),
    barcode: z.string().max(80).optional().nullable(),
    position: z.coerce.number().int().min(0).default(0),
    isActive: z.coerce.boolean().default(true),
    attributeValueIds: z.array(idField).default([]),
    inventory: z
      .object({
        quantityOnHand: z.coerce.number().int().min(0).default(0),
        reorderLevel: z.coerce.number().int().min(0).default(0),
        allowBackorder: z.coerce.boolean().default(false),
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.compareAtPrice == null ||
      data.price == null ||
      data.compareAtPrice >= data.price,
    {
      message: "Preço comparativo deve ser >= preço da variante",
      path: ["compareAtPrice"],
    },
  );

export const productImageSchema = z.object({
  url: z.url(),
  alt: z.string().max(160).optional().nullable(),
  position: z.coerce.number().int().min(0).default(0),
  isPrimary: z.coerce.boolean().default(false),
  variantSku: z.string().optional().nullable(),
});

export const createProductSchema = z
  .object({
    name: z.string().min(2).max(160),
    slug: slugField,
    description: z.string().optional().nullable(),
    shortDescription: z.string().max(300).optional().nullable(),
    status: productStatusSchema.default("DRAFT"),
    productTypeId: idField,
    categoryId: idField.optional().nullable(),
    brandId: idField.optional().nullable(),
    basePrice: z.coerce.number().min(0),
    compareAtPrice: z.coerce.number().min(0).optional().nullable(),
    currency: z.string().length(3).default("BRL"),
    isFeatured: z.coerce.boolean().default(false),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    images: z.array(productImageSchema).default([]),
    assignments: z.array(productAssignmentSchema).default([]),
    variants: z
      .array(productVariantInputSchema)
      .min(1, "Crie ao menos uma variante"),
  })
  .refine(
    (data) => data.compareAtPrice == null || data.compareAtPrice >= data.basePrice,
    {
      message: "Preço comparativo deve ser >= preço base",
      path: ["compareAtPrice"],
    },
  );

export type AttributeTypeInput = z.infer<typeof attributeTypeSchema>;
export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;
export type CreateProductTypeInput = z.infer<typeof createProductTypeSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;
export type ProductAssignmentInput = z.infer<typeof productAssignmentSchema>;
