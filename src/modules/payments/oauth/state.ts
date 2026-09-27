import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

/** Validade do state OAuth (a MP também expira o `code` em 10 min). */
const STATE_TTL_MS = 10 * 60 * 1000;

export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

/** `code_verifier`: 43–128 chars (RFC 7636). */
export function generateCodeVerifier(): string {
  return randomBytes(64).toString("base64url").slice(0, 128);
}

export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export interface CreatedOAuthState {
  state: string;
  codeVerifier: string | null;
}

export async function createOAuthState(params: {
  provider: string;
  userId: string;
  usePkce: boolean;
}): Promise<CreatedOAuthState> {
  const state = generateState();
  const codeVerifier = params.usePkce ? generateCodeVerifier() : null;

  await prisma.paymentOAuthState.create({
    data: {
      state,
      provider: params.provider,
      userId: params.userId,
      codeVerifier,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  });

  return { state, codeVerifier };
}

/**
 * Consome o state de forma atômica (uso único). Retorna `null` se não existir,
 * já tiver sido consumido, for de outro provider ou estiver expirado.
 */
export async function consumeOAuthState(params: {
  provider: string;
  state: string;
}): Promise<{ userId: string; codeVerifier: string | null } | null> {
  const claimed = await prisma.paymentOAuthState.updateMany({
    where: {
      state: params.state,
      provider: params.provider,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  const row = await prisma.paymentOAuthState.findUnique({
    where: { state: params.state },
  });
  if (!row) return null;
  return { userId: row.userId, codeVerifier: row.codeVerifier };
}

/**
 * Detecta uma tentativa de conexão "presa": um state válido (não expirado) que
 * não foi consumido depois de alguns minutos — sinal de que o callback desta
 * loja não foi atingido (Redirect URI divergente/inacessível).
 */
export async function hasStuckOAuthAttempt(params: {
  provider: string;
  olderThanMs?: number;
}): Promise<boolean> {
  const cutoff = new Date(Date.now() - (params.olderThanMs ?? 2 * 60 * 1000));
  const row = await prisma.paymentOAuthState.findFirst({
    where: {
      provider: params.provider,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      createdAt: { lte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });
  return Boolean(row);
}
