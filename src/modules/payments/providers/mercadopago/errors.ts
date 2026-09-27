/**
 * Erros do Mercado Pago normalizados para o domínio. Preservam status/código
 * para observabilidade, mas nunca carregam tokens/secrets.
 */
export type MercadoPagoErrorKind =
  "network" | "timeout" | "unauthorized" | "validation" | "api";

export class MercadoPagoError extends Error {
  readonly kind: MercadoPagoErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(params: {
    kind: MercadoPagoErrorKind;
    message: string;
    status?: number;
    code?: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "MercadoPagoError";
    this.kind = params.kind;
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }

  /** Indica se uma nova tentativa pode resolver (rede/timeout/5xx). */
  get retryable(): boolean {
    if (this.kind === "timeout" || this.kind === "network") return true;
    return typeof this.status === "number" && this.status >= 500;
  }
}

/** Traduz o erro para um status HTTP apropriado na nossa API. */
export function toHttpStatus(error: unknown): number {
  if (!(error instanceof MercadoPagoError)) return 500;
  switch (error.kind) {
    case "timeout":
      return 504;
    case "network":
      return 502;
    case "unauthorized":
      return 401;
    case "validation":
      return 422;
    case "api":
      return error.status && error.status >= 400 && error.status < 500
        ? error.status
        : 502;
    default:
      return 500;
  }
}

/** Mensagem segura para o usuário final (sem detalhes internos). */
export function friendlyMercadoPagoMessage(error: unknown): string {
  if (!(error instanceof MercadoPagoError)) {
    return "Não foi possível processar o pagamento. Tente novamente.";
  }
  if (error.code === "invalid_payer_email" || /payer\.email/i.test(error.message)) {
    return "Informe um e-mail válido do comprador (ex.: nome@dominio.com).";
  }
  switch (error.kind) {
    case "timeout":
      return "O Mercado Pago demorou para responder. Tente novamente.";
    case "network":
      return "Não foi possível contatar o Mercado Pago. Tente novamente.";
    case "unauthorized":
      return "Conta do Mercado Pago não conectada ou credenciais inválidas.";
    case "validation":
      return "Dados de pagamento inválidos.";
    default:
      return "O Mercado Pago recusou a operação. Tente novamente.";
  }
}
