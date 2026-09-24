export interface CartItemAttributeDTO {
  attributeName: string;
  value: string;
}

export interface CartItemDTO {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  variantName: string | null;
  sku: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  image: string | null;
  attributes: CartItemAttributeDTO[];
  availableStock: number | null;
  allowBackorder: boolean;
}

export interface CartDTO {
  id: string;
  currency: string;
  items: CartItemDTO[];
  itemCount: number;
  subtotal: number;
}
