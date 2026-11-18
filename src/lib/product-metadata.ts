import type { Metadata } from "next";

export function storefrontOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): URL {
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production");
  }
  const url = new URL(value ?? "http://localhost:3000");
  if (url.username || url.password || !["https:", "http:"].includes(url.protocol)) {
    throw new Error("Invalid storefront URL");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost") url.protocol = "https:";
  return new URL(url.origin);
}

export function productMetadata(
  product: {
    slug: string;
    name: string;
    image: string | null;
    shortDescription?: string | null;
    description?: string | null;
  },
  base = storefrontOrigin(),
): Metadata {
  const canonical = new URL(`/produtos/${encodeURIComponent(product.slug)}`, base).href;
  const description =
    product.shortDescription?.trim() || product.description?.trim() || product.name;
  // Only a product slug is accepted by this endpoint; no arbitrary URL is proxied.
  const image = product.image
    ? new URL(`/media/products/${encodeURIComponent(product.slug)}/preview.jpg`, base)
        .href
    : null;
  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      url: canonical,
      images: image
        ? [
            {
              url: image,
              secureUrl: image,
              type: "image/jpeg",
              width: 1200,
              height: 1200,
              alt: product.name,
            },
          ]
        : [],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: product.name,
      description,
      images: image ? [image] : [],
    },
  };
}
