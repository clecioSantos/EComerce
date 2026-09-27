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
