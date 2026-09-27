import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

/**
 * Autoriza chamadas de cron/jobs via `x-cron-secret` ou `Authorization: Bearer`.
 * Retorna `false` quando não há segredo configurado ou o valor não confere.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const provided = (request.headers.get("x-cron-secret") ?? bearer ?? "").trim();
  if (!provided) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
