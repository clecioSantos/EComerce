import "server-only";

import { getEnv } from "@/lib/env";

import { MercadoPagoClient, requestOAuthToken } from "../providers/mercadopago/client";
import { MercadoPagoError } from "../providers/mercadopago/errors";
import { MERCADOPAGO_PROVIDER_ID, saveMercadoPagoTokens } from "./account.service";
import { codeChallengeS256, consumeOAuthState, createOAuthState } from "./state";

export interface AuthorizationRequest {
  url: string;
  state: string;
}

/** Monta a URL de autorização e registra o state de uso único. */
export async function createMercadoPagoAuthorization(params: {
  userId: string;
}): Promise<AuthorizationRequest> {
  const env = getEnv();
  if (!env.MERCADOPAGO_CLIENT_ID || !env.MERCADOPAGO_REDIRECT_URI) {
    throw new MercadoPagoError({
      kind: "validation",
      message: "OAuth do Mercado Pago não configurado (CLIENT_ID/REDIRECT_URI).",
    });
  }

  const usePkce = env.MERCADOPAGO_PKCE_ENABLED;
  const { state, codeVerifier } = await createOAuthState({
    provider: MERCADOPAGO_PROVIDER_ID,
    userId: params.userId,
    usePkce,
  });

  const url = new URL("/authorization", env.MERCADOPAGO_AUTH_URL);
  url.searchParams.set("client_id", env.MERCADOPAGO_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", env.MERCADOPAGO_REDIRECT_URI);
  if (usePkce && codeVerifier) {
    url.searchParams.set("code_challenge", codeChallengeS256(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
  }

  return { url: url.toString(), state };
}

/** Valida o state, troca o code por tokens e persiste a conta conectada. */
export async function completeMercadoPagoOAuth(params: {
  code: string;
  state: string;
}): Promise<{ userId: string; providerUserId: string | null }> {
  const consumed = await consumeOAuthState({
    provider: MERCADOPAGO_PROVIDER_ID,
    state: params.state,
  });
  if (!consumed) {
    throw new MercadoPagoError({
      kind: "validation",
      message: "State OAuth inválido, expirado ou já utilizado.",
    });
  }

  const env = getEnv();
  const token = await requestOAuthToken({
    client_id: env.MERCADOPAGO_CLIENT_ID,
    client_secret: env.MERCADOPAGO_CLIENT_SECRET,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: env.MERCADOPAGO_REDIRECT_URI,
    ...(consumed.codeVerifier ? { code_verifier: consumed.codeVerifier } : {}),
  });

  if (!token.access_token) {
    throw new MercadoPagoError({
      kind: "unauthorized",
      message: "Mercado Pago não retornou access token.",
    });
  }

  let providerUserId = token.user_id != null ? String(token.user_id) : null;
  if (!providerUserId) {
    try {
      const client = new MercadoPagoClient({
        apiUrl: env.MERCADOPAGO_API_URL,
        timeoutMs: env.MERCADOPAGO_TIMEOUT_MS,
      });
      const me = await client.getMe(token.access_token);
      providerUserId = me.id != null ? String(me.id) : null;
    } catch {
      // Não é crítico; o token já foi obtido.
    }
  }

  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000)
    : null;

  await saveMercadoPagoTokens({
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    publicKey: token.public_key ?? null,
    tokenType: token.token_type ?? null,
    scope: token.scope ?? null,
    expiresAt,
    providerUserId,
    liveMode: token.live_mode ?? false,
  });

  return { userId: consumed.userId, providerUserId };
}
