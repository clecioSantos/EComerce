import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getEnv } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

/**
 * Deriva uma chave de 32 bytes a partir de `PAYMENT_TOKEN_ENCRYPTION_KEY`.
 * Aceita base64 (32 bytes), hex (64 chars) ou texto livre (hash SHA-256).
 */
export function deriveKey(secret: string): Buffer {
  const trimmed = secret.trim();

  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) return base64;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");

  return createHash("sha256").update(trimmed).digest();
}

function getKey(): Buffer {
  const secret = getEnv().PAYMENT_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "PAYMENT_TOKEN_ENCRYPTION_KEY não configurada; não é possível cifrar tokens.",
    );
  }
  return deriveKey(secret);
}

/** Cifra um valor sensível (token OAuth) em formato `v1:iv:tag:ciphertext`. */
export function encryptSecret(plaintext: string, key: Buffer = getKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Decifra um valor produzido por `encryptSecret`. Tolera valores legados. */
export function decryptSecret(payload: string, key: Buffer = getKey()): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    // Valor legado/não cifrado: devolve como está para permitir migração suave.
    return payload;
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
