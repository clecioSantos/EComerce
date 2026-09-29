/** Contratos (parciais) da API do Mercado Pago que consumimos. */

export interface MercadoPagoPayment {
  id: number | string;
  status: string;
  status_detail?: string;
  payment_method_id?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string | null;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null;
      qr_code_base64?: string | null;
      ticket_url?: string | null;
    };
  };
  [key: string]: unknown;
}

export interface MercadoPagoOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  public_key?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  user_id?: number | string;
  live_mode?: boolean;
}

export interface MercadoPagoUser {
  id: number | string;
  nickname?: string;
  email?: string;
  [key: string]: unknown;
}

export interface MercadoPagoRefundResponse {
  id: number | string;
  status?: string;
  amount?: number;
  [key: string]: unknown;
}

export interface MercadoPagoCustomer {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

export interface MercadoPagoCustomerSearch {
  results?: MercadoPagoCustomer[];
  paging?: unknown;
}

export interface MercadoPagoCard {
  id: string;
  customer_id?: string;
  expiration_month?: number;
  expiration_year?: number;
  first_six_digits?: string;
  last_four_digits?: string;
  cardholder?: { name?: string; identification?: unknown } | null;
  payment_method?: { id?: string; name?: string; thumbnail?: string } | null;
  issuer?: { id?: number | string } | null;
  [key: string]: unknown;
}
