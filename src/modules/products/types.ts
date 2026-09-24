import type {
  AttributeType,
  ProductStatus,
} from "@/generated/prisma/enums";

export interface AttributeValueDTO {
  id: string;
  attributeId: string;
  value: string;
  slug: string;
  position: number;
}

export interface AttributeDTO {
  id: string;
  name: string;
  slug: string;
  type: AttributeType;
  unit: string | null;
  isRequired: boolean;
  allowMultiple: boolean;
  isFilterable: boolean;
  isVariantDefining: boolean;
  position: number;
  values: AttributeValueDTO[];
}

export interface ProductTypeDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  attributes: AttributeDTO[];
}

export interface VariantAttributeDTO {
  attributeId: string;
  attributeName: string;
  attributeSlug: string;
  attributeType: AttributeType;
  valueId: string;
  value: string;
  valueSlug: string;
}

export interface InventoryDTO {
  id: string;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
  reorderLevel: number;
  allowBackorder: boolean;
}

export interface VariantDTO {
  id: string;
  productId: string;
  sku: string;
  name: string | null;
  price: number;
  compareAtPrice: number | null;
  weight: number | null;
  isActive: boolean;
  position: number;
  attributes: VariantAttributeDTO[];
  inventory: InventoryDTO | null;
  image: string | null;
}

export interface ProductImageDTO {
  id: string;
  url: string;
  alt: string | null;
  position: number;
  isPrimary: boolean;
  variantId: string | null;
}

export interface ProductAssignmentDTO {
  attributeId: string;
  attributeName: string;
  attributeSlug: string;
  attributeType: AttributeType;
  valueId: string | null;
  value: string | null;
  raw: unknown;
}

export interface ProductSummaryDTO {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  status: ProductStatus;
  basePrice: number;
  compareAtPrice: number | null;
  currency: string;
  isFeatured: boolean;
  image: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  productTypeSlug: string;
  inStock: boolean;
  createdAt: string;
}

export interface ProductDetailDTO extends ProductSummaryDTO {
  description: string | null;
  productType: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string } | null;
  brand: { id: string; name: string; slug: string } | null;
  images: ProductImageDTO[];
  variants: VariantDTO[];
  assignments: ProductAssignmentDTO[];
  metadata: Record<string, unknown> | null;
}
