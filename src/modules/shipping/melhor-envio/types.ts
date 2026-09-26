/**
 * Tipos da API do Melhor Envio (cotação por produtos).
 * Referência: POST /api/v2/me/shipment/calculate
 */

export interface MelhorEnvioConfig {
  baseUrl: string;
  token: string;
  userAgent: string;
}

export interface MelhorEnvioProduct {
  id: string;
  width: number;
  height: number;
  length: number;
  weight: number;
  insurance_value: number;
  quantity: number;
}

export interface MelhorEnvioCalculateRequest {
  from: { postal_code: string };
  to: { postal_code: string };
  products: MelhorEnvioProduct[];
  options?: {
    receipt?: boolean;
    own_hand?: boolean;
  };
  /** IDs de serviços separados por vírgula (ex.: "1,2,18"). */
  services?: string;
}

export interface MelhorEnvioDeliveryRange {
  min?: number | null;
  max?: number | null;
}

export interface MelhorEnvioQuote {
  id: number | string;
  name: string;
  price?: string | number | null;
  custom_price?: string | number | null;
  discount?: string | number | null;
  currency?: string;
  delivery_time?: number | null;
  delivery_range?: MelhorEnvioDeliveryRange | null;
  custom_delivery_time?: number | null;
  custom_delivery_range?: MelhorEnvioDeliveryRange | null;
  packages?: unknown[];
  company?: { id?: number; name?: string; picture?: string } | null;
  error?: string | null;
}

export interface MelhorEnvioService {
  id: number | string;
  name: string;
  company?: { id?: number; name?: string } | null;
}

export interface MelhorEnvioCalculator {
  calculate(request: MelhorEnvioCalculateRequest): Promise<MelhorEnvioQuote[]>;
}
