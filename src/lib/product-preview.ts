import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { storefrontOrigin } from "./product-metadata";

const MAX_INPUT = 8 * 1024 * 1024;
// Fixed providers already used by the storefront. Never accept a hostname from a request.
const REMOTE_HOSTS = new Set([
  "images.unsplash.com",
  "picsum.photos",
  "fastly.picsum.photos",
  "placehold.co",
]);
const TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const cache = new Map<string, { bytes: Buffer; expires: number }>();
const pending = new Map<string, Promise<Buffer>>();

export function previewSource(value: string): URL {
  const base = storefrontOrigin();
  const url = new URL(value, base);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.origin !== base.origin && url.port && url.port !== "443")
  )
    throw new Error("Invalid image URL");
  if (url.origin === base.origin) {
    if (!/\.(jpe?g|png|webp|avif|gif)$/i.test(url.pathname))
      throw new Error("Not a public image file");
  } else if (url.protocol !== "https:" || !REMOTE_HOSTS.has(url.hostname)) {
    throw new Error("Image provider not allowed");
  }
  return url;
}

async function sourceBytes(source: string): Promise<Buffer> {
  let url = previewSource(source);
  if (url.origin === storefrontOrigin().origin) {
    // Read only actual raster files inside public, including symlink containment checks.
    const root = await realpath(path.resolve("public"));
    const file = await realpath(
      path.resolve(root, "." + decodeURIComponent(url.pathname)),
    );
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Private image path");
    if ((await stat(file)).size > MAX_INPUT) throw new Error("Image too large");
    return readFile(file);
  }
  const signal = AbortSignal.timeout(10_000);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        Accept: "image/jpeg,image/png,image/webp",
        "User-Agent": "EComerce-ProductPreview/1.0",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Invalid image redirect");
      url = previewSource(new URL(location, url).href);
      // Never follow provider redirects into the store or any private service.
      if (!REMOTE_HOSTS.has(url.hostname)) throw new Error("Invalid image redirect");
      continue;
    }
    if (
      response.status !== 200 ||
      !TYPES.has(response.headers.get("content-type")?.split(";")[0].trim() ?? "")
    ) {
      await response.body?.cancel();
      throw new Error("Image unavailable");
    }
    if (Number(response.headers.get("content-length")) > MAX_INPUT) {
      await response.body?.cancel();
      throw new Error("Image too large");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty image");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_INPUT) throw new Error("Image too large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Too many image redirects");
}

export async function productPreview(source: string): Promise<Buffer> {
  const key = createHash("sha256").update(source).digest("hex");
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.bytes;
  const existing = pending.get(key);
  if (existing) return existing;
  // Bound concurrent decodes and cache memory on the single Node process.
  if (pending.size >= 2) throw new Error("Preview busy");
  const task = (async () => {
    const input = await sourceBytes(source);
    const bytes = await sharp(input, { limitInputPixels: 16_000_000, animated: false })
      .rotate()
      .resize(1200, 1200, { fit: "contain", background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
    if (bytes.length > 5 * 1024 * 1024) throw new Error("Preview too large");
    if (cache.size >= 24) cache.delete(cache.keys().next().value!);
    cache.set(key, { bytes, expires: Date.now() + 60 * 60 * 1000 });
    return bytes;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
