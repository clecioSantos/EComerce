// Run against a running production build or the deployed store. No JavaScript browser is used.
import assert from "node:assert/strict";
import sharp from "sharp";
const base = new URL(process.argv[2] || "http://localhost:3000");
const expectedOrigin = new URL(process.argv[4] || base).origin;
const slug = process.argv[3] || "demo-vestido-midi-aurora";
const page = new URL(`/produtos/${encodeURIComponent(slug)}`, base);
const agents = [
  "facebookexternalhit/1.1",
  "WhatsApp/2.24.0",
  "meta-externalagent/1.1",
  "Mozilla/5.0",
];
for (const agent of agents) {
  const response = await fetch(page, {
    redirect: "manual",
    headers: { "User-Agent": agent },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(
    response.status,
    200,
    `${agent}: public page must return 200 without redirect`,
  );
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  const head = html.slice(0, html.indexOf("</head>"));
  const metas = [...head.matchAll(/<meta\s+[^>]*>/g)].map(([tag]) => {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [
        key,
        value.replaceAll("&amp;", "&"),
      ]),
    );
    return [attrs.property || attrs.name, attrs.content];
  });
  const meta = Object.fromEntries(metas);
  for (const key of ["og:title", "og:description", "og:url", "og:image", "twitter:card"])
    assert.ok(meta[key], `${agent}: ${key} missing from initial head`);
  const canonical = new URL(meta["og:url"]);
  assert.equal(canonical.pathname, page.pathname);
  assert.equal(canonical.origin, expectedOrigin);
  const image = new URL(meta["og:image"]);
  assert.equal(image.origin, expectedOrigin);
  assert.equal(image.pathname, `/media/products/${encodeURIComponent(slug)}/preview.jpg`);
  assert.ok(image.protocol === "https:" || image.hostname === "localhost");
  const result = await fetch(new URL(image.pathname + image.search, base), {
    redirect: "manual",
    headers: { "User-Agent": agent },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(result.status, 200, `${agent}: image unavailable`);
  assert.equal(result.headers.get("content-type"), "image/jpeg");
  const bytes = await result.arrayBuffer();
  assert.ok(bytes.byteLength > 0 && bytes.byteLength < 5 * 1024 * 1024);
  const dimensions = await sharp(bytes).metadata();
  assert.equal(dimensions.width, 1200);
  assert.equal(dimensions.height, 1200);
  console.log(
    `${agent}: HTTP 200, initial-head metadata, public JPEG ${bytes.byteLength} bytes, 1200x1200`,
  );
}
console.log(
  "HTTP/HTML validation passed. Visual preview still requires WhatsApp or Meta debugger confirmation.",
);
