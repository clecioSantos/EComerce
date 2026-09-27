import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { logEvent, logger } from "@/lib/logger";

import { requestOAuthToken } from "../providers/mercadopago/client";
import {
  accessTokenMatchesEnvironment,
  isMercadoPagoSandbox,
} from "../providers/mercadopago/environment";
import { MercadoPagoError } from "../providers/mercadopago/errors";

export const MERCADOPAGO_PROVIDER_ID = "mercadopago";

/** Renova o token quando faltam menos de 5 minutos para expirar. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
/** Duração do lease que serializa renovações concorrentes. */
const REFRESH_LEASE_MS = 30 * 1000;

export interface SaveTokensInput {
  accessToken: string;
  refreshToken?: string | null;
  publicKey?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  expiresAt?: Date | null;
  providerUserId?: string | null;
  liveMode?: boolean;
}

export interface MercadoPagoAccountInfo {
  providerUserId: string | null;
  publicKey: string | null;
  liveMode: boolean;
  scope: string | null;
  expiresAt: Date | null;
  connectedAt: Date;
  hasRefreshToken: boolean;
}

function computeExpiresAt(expiresIn?: number): Date | null {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

export async function saveMercadoPagoTokens(input: SaveTokensInput): Promise<void> {
  const accessToken = encryptSecret(input.accessToken);
  const refreshToken = input.refreshToken ? encryptSecret(input.refreshToken) : null;

  await prisma.paymentProviderAccount.upsert({
    where: { provider: MERCADOPAGO_PROVIDER_ID },
    create: {
      provider: MERCADOPAGO_PROVIDER_ID,
      providerUserId: input.providerUserId ?? null,
      accessToken,
      refreshToken,
      publicKey: input.publicKey ?? null,
      tokenType: input.tokenType ?? null,
      scope: input.scope ?? null,
      expiresAt: input.expiresAt ?? null,
      liveMode: input.liveMode ?? false,
    },
    update: {
      providerUserId: input.providerUserId ?? null,
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      publicKey: input.publicKey ?? null,
      tokenType: input.tokenType ?? null,
      scope: input.scope ?? null,
      expiresAt: input.expiresAt ?? null,
      liveMode: input.liveMode ?? false,
      refreshLockedUntil: null,
    },
  });

  logEvent("PAYMENT_OAUTH_CONNECTED", {
    provider: MERCADOPAGO_PROVIDER_ID,
    providerUserId: input.providerUserId ?? undefined,
  });
}

/** Metadados da conta conectada — NUNCA inclui tokens. */
export async function getMercadoPagoAccount(): Promise<MercadoPagoAccountInfo | null> {
  const account = await prisma.paymentProviderAccount.findUnique({
    where: { provider: MERCADOPAGO_PROVIDER_ID },
  });
  if (!account) return null;
  return {
    providerUserId: account.providerUserId,
    publicKey: account.publicKey,
    liveMode: account.liveMode,
    scope: account.scope,
    expiresAt: account.expiresAt,
    connectedAt: account.connectedAt,
    hasRefreshToken: Boolean(account.refreshToken),
  };
}

export async function disconnectMercadoPago(): Promise<void> {
  await prisma.paymentProviderAccount
    .delete({ where: { provider: MERCADOPAGO_PROVIDER_ID } })
    .catch(() => {});
  logEvent("PAYMENT_OAUTH_DISCONNECT", { provider: MERCADOPAGO_PROVIDER_ID });
}

/**
 * Retorna um access token válido, renovando via refresh token quando próximo da
 * expiração. A renovação é serializada por um lease no banco para evitar que
 * duas requisições concorrentes invalidem uma à outra.
 */
export async function getValidMercadoPagoAccessToken(): Promise<string> {
  const env = getEnv();
  const sandbox = isMercadoPagoSandbox(env.MERCADOPAGO_ENVIRONMENT);

  // Tokens estáticos são específicos do ambiente e NUNCA devem cruzar
  // sandbox/produção.
  const staticToken = sandbox
    ? env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN
    : env.MERCADOPAGO_ACCESS_TOKEN;

  // Em sandbox, o token de teste estático tem prioridade e dispensa OAuth —
  // facilita testar PIX/cartão localmente.
  if (sandbox && staticToken) {
    return staticToken;
  }

  const account = await prisma.paymentProviderAccount.findUnique({
    where: { provider: MERCADOPAGO_PROVIDER_ID },
  });

  if (!account) {
    if (staticToken) {
      if (!accessTokenMatchesEnvironment(staticToken, "production")) {
        logger.warn({
          event: "PAYMENT_TOKEN_ENV_MISMATCH",
          provider: MERCADOPAGO_PROVIDER_ID,
          message: "MERCADOPAGO_ACCESS_TOKEN parece ser de teste (TEST-) em produção.",
        });
      }
      return staticToken;
    }
    throw new MercadoPagoError({
      kind: "unauthorized",
      message: sandbox
        ? "Sandbox sem MERCADOPAGO_SANDBOX_ACCESS_TOKEN e sem conta conectada."
        : "Conta do Mercado Pago não conectada.",
    });
  }

  // A conta conectada precisa pertencer ao ambiente ativo; caso contrário,
  // usamos o token estático do ambiente ou falhamos com erro claro.
  const accountMismatch = sandbox ? account.liveMode : !account.liveMode;
  if (accountMismatch) {
    logger.warn({
      event: "PAYMENT_TOKEN_ENV_MISMATCH",
      provider: MERCADOPAGO_PROVIDER_ID,
      environment: sandbox ? "sandbox" : "production",
      message: sandbox
        ? "Conta conectada é de produção em ambiente sandbox."
        : "Conta conectada é de teste em ambiente de produção.",
    });
    if (staticToken) return staticToken;
    throw new MercadoPagoError({
      kind: "unauthorized",
      code: "account_environment_mismatch",
      message: sandbox
        ? "A conta conectada é de produção, mas o ambiente é sandbox. Reconecte a conta em sandbox ou defina MERCADOPAGO_SANDBOX_ACCESS_TOKEN (TEST-)."
        : "A conta conectada é de teste, mas o ambiente é produção. Conecte a conta de produção ou defina MERCADOPAGO_ACCESS_TOKEN.",
    });
  }

  const now = Date.now();
  const expiresAt = account.expiresAt?.getTime() ?? null;
  const withinMargin = expiresAt != null && expiresAt - now > REFRESH_MARGIN_MS;
  const current = decryptSecret(account.accessToken);
  if (expiresAt == null || withinMargin) return current;

  if (!account.refreshToken) {
    if (staticToken) return staticToken;
    throw new MercadoPagoError({
      kind: "unauthorized",
      message: "Access token expirado e sem refresh token.",
    });
  }

  const leased = await prisma.paymentProviderAccount.updateMany({
    where: {
      provider: MERCADOPAGO_PROVIDER_ID,
      OR: [{ refreshLockedUntil: null }, { refreshLockedUntil: { lt: new Date(now) } }],
    },
    data: { refreshLockedUntil: new Date(now + REFRESH_LEASE_MS) },
  });

  if (leased.count === 0) {
    // Outra instância está renovando: aguarda o token atualizar.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await sleep(500);
      const fresh = await prisma.paymentProviderAccount.findUnique({
        where: { provider: MERCADOPAGO_PROVIDER_ID },
      });
      if (
        fresh?.expiresAt &&
        fresh.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS
      ) {
        return decryptSecret(fresh.accessToken);
      }
    }
    throw new MercadoPagoError({
      kind: "network",
      message: "Não foi possível renovar o token do Mercado Pago (concorrência).",
    });
  }

  return refreshMercadoPagoToken();
}

async function refreshMercadoPagoToken(): Promise<string> {
  const account = await prisma.paymentProviderAccount.findUniqueOrThrow({
    where: { provider: MERCADOPAGO_PROVIDER_ID },
  });
  if (!account.refreshToken) {
    throw new MercadoPagoError({
      kind: "unauthorized",
      message: "Sem refresh token para renovar.",
    });
  }

  const env = getEnv();
  try {
    const token = await requestOAuthToken({
      client_id: env.MERCADOPAGO_CLIENT_ID,
      client_secret: env.MERCADOPAGO_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: decryptSecret(account.refreshToken),
    });

    await prisma.paymentProviderAccount.update({
      where: { provider: MERCADOPAGO_PROVIDER_ID },
      data: {
        accessToken: encryptSecret(token.access_token),
        ...(token.refresh_token
          ? { refreshToken: encryptSecret(token.refresh_token) }
          : {}),
        expiresAt: computeExpiresAt(token.expires_in),
        refreshLockedUntil: null,
      },
    });

    logEvent("PAYMENT_OAUTH_REFRESH", {
      provider: MERCADOPAGO_PROVIDER_ID,
      expiresAt: computeExpiresAt(token.expires_in)?.toISOString(),
    });

    return token.access_token;
  } catch (error) {
    // Libera o lease para permitir nova tentativa.
    await prisma.paymentProviderAccount
      .update({
        where: { provider: MERCADOPAGO_PROVIDER_ID },
        data: { refreshLockedUntil: null },
      })
      .catch(() => {});
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
