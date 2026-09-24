import "server-only";

import { headers } from "next/headers";

/**
 * Lê o `x-request-id` propagado pelo proxy. Retorna `undefined` quando não há
 * contexto de requisição (ex.: scripts, jobs), sem lançar.
 */
export async function getRequestId(): Promise<string | undefined> {
  try {
    const requestHeaders = await headers();
    return requestHeaders.get("x-request-id") ?? undefined;
  } catch {
    return undefined;
  }
}
