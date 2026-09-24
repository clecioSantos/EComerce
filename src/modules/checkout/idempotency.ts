import { createHash } from "node:crypto";

/**
 * Serialização determinística (chaves ordenadas recursivamente) para que o
 * mesmo payload semântico produza sempre o mesmo hash, independente da ordem
 * das chaves.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
  return `{${entries.join(",")}}`;
}

/** SHA-256 determinístico do payload da requisição de checkout. */
export function computeRequestHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
