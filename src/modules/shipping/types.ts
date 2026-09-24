/**
 * Abstração de frete. O checkout fala apenas com esta interface — nunca
 * diretamente com Correios/Melhor Envio/etc.
 */

export interface ShippingAddress {
  postalCode: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ShippingItem {
  variantId: string;
  quantity: number;
  weight?: number | null;
}

export interface ShippingQuoteInput {
  address?: ShippingAddress | null;
  items: ShippingItem[];
  subtotal: number;
}

export interface ShippingOption {
  id: string;
  provider: string;
  label: string;
  description?: string;
  price: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
}

export interface ShippingProvider {
  readonly id: string;
  readonly name: string;
  quote(input: ShippingQuoteInput): Promise<ShippingOption[]>;
}
