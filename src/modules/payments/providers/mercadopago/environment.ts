export type MercadoPagoEnvironment = "sandbox" | "production";

/** Normaliza o valor do ambiente (default produção). */
export function resolveMercadoPagoEnvironment(
  value?: string | null,
): MercadoPagoEnvironment {
  return value === "sandbox" ? "sandbox" : "production";
}

export function isMercadoPagoSandbox(value?: string | null): boolean {
  return resolveMercadoPagoEnvironment(value) === "sandbox";
}

/**
 * Em sandbox as credenciais começam com `TEST-`; em produção, com `APP_USR-`.
 * Usado para avisar quando a Public Key não corresponde ao ambiente.
 */
export function publicKeyMatchesEnvironment(
  publicKey: string | null | undefined,
  environment: MercadoPagoEnvironment,
): boolean {
  if (!publicKey) return false;
  const isTest = publicKey.startsWith("TEST-");
  return environment === "sandbox" ? isTest : !isTest;
}

/** Seleciona a Public Key conforme o ambiente (fallback para a de produção). */
export function selectMercadoPagoPublicKey(params: {
  environment: MercadoPagoEnvironment;
  productionPublicKey?: string | null;
  sandboxPublicKey?: string | null;
}): string | null {
  const { environment, productionPublicKey, sandboxPublicKey } = params;
  if (environment === "sandbox") {
    return sandboxPublicKey ?? productionPublicKey ?? null;
  }
  return productionPublicKey ?? null;
}
