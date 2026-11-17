import { createCipheriv, createDecipheriv, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { config } from "./config.js";
const key = Buffer.from(config.MASTER_ENCRYPTION_KEY, "hex");

export function encrypt(text: string) {
 const iv = randomBytes(12);
 const cipher = createCipheriv("aes-256-gcm", key, iv);
 const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
 return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(".");
}
export function decrypt(value: string) {
 const [iv, tag, payload] = value.split(".");
 if (!iv || !tag || !payload) throw new Error("Invalid ciphertext");
 const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
 decipher.setAuthTag(Buffer.from(tag, "hex"));
 return Buffer.concat([decipher.update(Buffer.from(payload, "hex")), decipher.final()]).toString("utf8");
}
export function safeEqual(a: string, b: string) {
 const x = Buffer.from(a), y = Buffer.from(b);
 return x.length === y.length && timingSafeEqual(x, y);
}
export function validMetaSignature(body: Buffer, signature: string | undefined) {
 if (!signature?.startsWith("sha256=")) return false;
 const expected = "sha256=" + createHmac("sha256", config.META_APP_SECRET).update(body).digest("hex");
 return safeEqual(signature, expected);
}
