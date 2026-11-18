// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { productMetadata, storefrontOrigin } from "@/lib/product-metadata";
import { previewSource, productPreview } from "@/lib/product-preview";

const db = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { product: db } }));
import { GET } from "@/app/media/products/[slug]/preview.jpg/route";

let sequence = 0;
const remote = () => `https://images.unsplash.com/photo-test-${++sequence}`;
const photo = () =>
  sharp({ create: { width: 320, height: 480, channels: 3, background: "#ff0000" } })
    .png()
    .toBuffer();
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("product metadata", () => {
  it.each([
    "https://images.unsplash.com/real.jpg",
    "/photos/real.jpg",
    "photos/real.jpg",
  ])("uses store-owned preview for real source %s", (image) => {
    const metadata = productMetadata(
      {
        slug: "vestido aurora",
        name: "Aurora",
        image,
        shortDescription: "",
        description: "Descrição completa",
      },
      new URL("https://loja.example"),
    );
    expect(metadata).toMatchObject({
      description: "Descrição completa",
      alternates: { canonical: "https://loja.example/produtos/vestido%20aurora" },
      openGraph: {
        title: "Aurora",
        description: "Descrição completa",
        url: "https://loja.example/produtos/vestido%20aurora",
        images: [
          {
            url: "https://loja.example/media/products/vestido%20aurora/preview.jpg",
            secureUrl: "https://loja.example/media/products/vestido%20aurora/preview.jpg",
            width: 1200,
            height: 1200,
            type: "image/jpeg",
            alt: "Aurora",
          },
        ],
      },
      twitter: { card: "summary_large_image" },
    });
  });
  it("does not invent a photo when product has none", () => {
    expect(
      productMetadata(
        { slug: "sem-foto", name: "Produto", image: null },
        new URL("https://loja.example"),
      ),
    ).toMatchObject({
      openGraph: { images: [], description: "Produto" },
      twitter: { card: "summary", images: [] },
    });
  });
  it("requires the public origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(() => storefrontOrigin()).toThrow("NEXT_PUBLIC_SITE_URL");
  });
  it("upgrades public site URLs to HTTPS and rejects credentials", () => {
    expect(storefrontOrigin("http://loja.example/path").href).toBe(
      "https://loja.example/",
    );
    expect(() => storefrontOrigin("https://user:pass@loja.example")).toThrow();
  });
});

describe("safe product preview", () => {
  it.each([
    "http://images.unsplash.com/a.jpg",
    "https://127.0.0.1/a.jpg",
    "https://169.254.169.254/a.jpg",
    "https://images.unsplash.com.evil.test/a.jpg",
    "https://user:pass@images.unsplash.com/a.jpg",
    "https://images.unsplash.com:8443/a.jpg",
    "file:///etc/passwd",
    "/.env",
    "/api/private",
    "//evil.test/a.jpg",
  ])("rejects %s before network access", (source) => {
    expect(() => previewSource(source)).toThrow();
  });
  it("produces a bounded 1200px JPEG from an external image", async () => {
    const input = await photo();
    const fetcher = vi.fn(
      async () =>
        new Response(new Uint8Array(input), { headers: { "Content-Type": "image/png" } }),
    );
    vi.stubGlobal("fetch", fetcher);
    const source = remote();
    const bytes = await productPreview(source);
    expect(await sharp(bytes).metadata()).toMatchObject({
      width: 1200,
      height: 1200,
      format: "jpeg",
    });
    expect(bytes.length).toBeLessThan(5 * 1024 * 1024);
    expect(await productPreview(source)).toBe(bytes);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["/photos/p.jpg", "photos/p.jpg"])(
    "accepts a relative public image %s",
    (source) => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://loja.example");
      expect(previewSource(source).href).toBe("https://loja.example/photos/p.jpg");
    },
  );
  it("reads relative files only from public", async () => {
    await mkdir("public", { recursive: true });
    const dir = await mkdtemp(path.resolve("public/preview-test-"));
    try {
      await writeFile(path.join(dir, "product.png"), await photo());
      const bytes = await productPreview(`/${path.basename(dir)}/product.png`);
      expect(await sharp(bytes).metadata()).toMatchObject({
        format: "jpeg",
        width: 1200,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("rejects redirects to private addresses without fetching them", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/private" },
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(productPreview(remote())).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    () => new Response("login", { headers: { "Content-Type": "text/html" } }),
    () => new Response(null, { status: 403 }),
    () => new Response("fake jpeg", { headers: { "Content-Type": "image/jpeg" } }),
    () =>
      new Response("large", {
        headers: { "Content-Type": "image/jpeg", "Content-Length": "9000000" },
      }),
    () =>
      new Response(new Uint8Array(8 * 1024 * 1024 + 1), {
        headers: { "Content-Type": "image/jpeg" },
      }),
  ])("rejects invalid, denied and oversized sources", async (response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
    await expect(productPreview(remote())).rejects.toThrow();
  });
  it("serves the primary database image publicly with correct headers", async () => {
    const source = remote();
    db.findFirst.mockResolvedValue({ images: [{ url: source }] });
    const input = await photo();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array(input), {
            headers: { "Content-Type": "image/png" },
          }),
      ),
    );
    const response = await GET(
      new Request(
        "https://loja.example/media/products/aurora/preview.jpg?url=https://evil.test",
      ),
      { params: Promise.resolve({ slug: "aurora" }) },
    );
    expect(db.findFirst).toHaveBeenCalledWith({
      where: { slug: "aurora", status: "ACTIVE" },
      select: {
        images: {
          orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
          take: 1,
          select: { url: true },
        },
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    const bytes = await response.arrayBuffer();
    expect(Number(response.headers.get("content-length"))).toBe(bytes.byteLength);
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 1200, height: 1200 });
  });
  it.each([null, { images: [] }])(
    "returns 404 for missing/inactive products or missing images",
    async (product) => {
      db.findFirst.mockResolvedValue(product);
      const response = await GET(new Request("https://loja.example"), {
        params: Promise.resolve({ slug: "missing" }),
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );
});
