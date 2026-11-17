import { decrypt } from "./security.js";
import type { Store } from "./db.js";

async function commerce(store: Store, method: "GET"|"POST", path: string, data?: unknown) {
 const base = new URL(store.store_url);
 if (base.protocol !== "https:" && !(base.hostname === "localhost" && base.protocol === "http:"))
   throw new Error("Loja deve usar HTTPS");
 const endpoint = new URL(path, base);
 if (endpoint.origin !== base.origin || !endpoint.pathname.startsWith("/api/agent/v1/"))
   throw new Error("Endpoint comercial inválido");
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), 10000);
 try {
  const response = await fetch(endpoint, {
    method, headers: { Authorization: "Bearer " + decrypt(store.commerce_api_key_enc),
      ...(data ? { "Content-Type": "application/json" } : {}) },
    body: data ? JSON.stringify(data) : undefined, signal: controller.signal,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error("API da loja indisponível ou recusou a solicitação (" + response.status + ")");
  return payload;
 } finally { clearTimeout(timeout); }
}
export async function searchProducts(store: Store, term: string) {
 return commerce(store, "GET", "/api/agent/v1/products?q=" + encodeURIComponent(term.slice(0,120)) + "&limit=8");
}
export async function getProduct(store: Store, id: string) {
 return commerce(store, "GET", "/api/agent/v1/products/" + encodeURIComponent(id));
}
export async function generateCheckout(store: Store, items: { variantId: string; quantity: number }[]) {
 return commerce(store, "POST", "/api/agent/v1/checkout-links", { items });
}
