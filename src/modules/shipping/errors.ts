/**
 * Erros de frete tipados. A camada HTTP traduz `code` em mensagens amigáveis e
 * status apropriados, sem vazar detalhes técnicos nem credenciais.
 */

export type ShippingErrorCode =
  | "INVALID_POSTAL_CODE"
  | "ORIGIN_NOT_CONFIGURED"
  | "EMPTY_CART"
  | "MISSING_LOGISTICS"
  | "NO_SERVICES"
  | "PROVIDER_AUTH"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export class ShippingError extends Error {
  readonly code: ShippingErrorCode;

  constructor(code: ShippingErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ShippingError";
    this.code = code;
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

export interface MissingLogisticsEntry {
  variantId: string;
  sku: string | null;
  /** Campos ausentes/inválidos: "weight" | "width" | "height" | "length". */
  missing: string[];
}

/**
 * Variante sem dados logísticos completos. Carrega os itens incompletos para
 * que o administrador consiga identificar exatamente o que falta cadastrar.
 * Nunca deve ser apresentado ao cliente final.
 */
export class MissingShippingDataError extends ShippingError {
  readonly variants: MissingLogisticsEntry[];

  constructor(variants: MissingLogisticsEntry[]) {
    const summary = variants
      .map((entry) => `${entry.sku ?? entry.variantId} (${entry.missing.join(", ")})`)
      .join("; ");
    super(
      "MISSING_LOGISTICS",
      `Variante(s) sem dados logísticos para frete: ${summary}.`,
    );
    this.name = "MissingShippingDataError";
    this.variants = variants;
  }
}

export function isShippingError(error: unknown): error is ShippingError {
  return error instanceof ShippingError;
}

/**
 * Mensagens amigáveis ao cliente final. Nunca contêm detalhes técnicos, nomes
 * de variantes ou credenciais — as informações de diagnóstico ficam nos logs.
 */
export const SHIPPING_MESSAGES: Record<ShippingErrorCode, string> = {
  INVALID_POSTAL_CODE: "Informe um CEP válido (8 dígitos).",
  ORIGIN_NOT_CONFIGURED:
    "O cálculo de frete está indisponível no momento. Tente novamente mais tarde.",
  EMPTY_CART: "Seu carrinho está vazio.",
  MISSING_LOGISTICS:
    "Não foi possível calcular o frete de um dos itens. Fale com o suporte.",
  NO_SERVICES: "Nenhuma opção de entrega está disponível no momento.",
  PROVIDER_AUTH: "O cálculo de frete está indisponível no momento.",
  PROVIDER_TIMEOUT: "O cálculo de frete demorou demais. Tente novamente.",
  PROVIDER_UNAVAILABLE:
    "Não foi possível calcular o frete agora. Tente novamente em instantes.",
  INVALID_RESPONSE:
    "Não foi possível calcular o frete agora. Tente novamente em instantes.",
  UNKNOWN: "Não foi possível calcular o frete.",
};

export function friendlyShippingMessage(error: unknown): string {
  if (isShippingError(error)) return SHIPPING_MESSAGES[error.code];
  return SHIPPING_MESSAGES.UNKNOWN;
}
