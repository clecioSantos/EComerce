/**
 * Abstração de frete. O checkout fala apenas com esta interface — nunca
 * diretamente com Correios/Melhor Envio/etc.
 *
 * O cálculo é genérico: depende somente de dados logísticos (peso/dimensões),
 * nunca do tipo/categoria do produto. Qualquer produto físico (roupas,
 * eletrônicos, livros, cosméticos...) usa o mesmo mecanismo.
 */

export interface ShippingAddress {
  postalCode: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ShippingItem {
  variantId: string;
  /** Identificador exibido ao provedor (preferencialmente o SKU). */
  sku?: string;
  quantity: number;
  /** Peso unitário em kg. */
  weight?: number | null;
  /** Dimensões unitárias em cm. */
  width?: number | null;
  height?: number | null;
  length?: number | null;
  /** Valor unitário segurado (usado no cálculo do seguro do frete). */
  unitPrice?: number;
}

export interface ShippingQuoteInput {
  /** CEP de origem da loja. */
  origin?: ShippingAddress | null;
  /** Endereço de destino (o CEP é o dado essencial). */
  address?: ShippingAddress | null;
  items: ShippingItem[];
  subtotal: number;
  /** Serviços habilitados (IDs do provedor). Quando ausente, usa o padrão. */
  services?: string[];
}

export interface ShippingPackage {
  weight: number;
  width: number;
  height: number;
  length: number;
  price?: number;
  insuranceValue?: number;
}

/** Serviço de frete disponível para configuração (id + rótulo amigável). */
export interface ShippingServiceOption {
  id: string;
  name: string;
  companyName?: string;
}

export interface ShippingOption {
  id: string;
  provider: string;
  label: string;
  description?: string;
  companyName?: string;
  price: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  packages?: ShippingPackage[];
}

export interface ShippingProvider {
  readonly id: string;
  readonly name: string;
  quote(input: ShippingQuoteInput): Promise<ShippingOption[]>;
}
