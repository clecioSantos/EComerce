"use client";

import {
  resolveMercadoPagoEnvironment,
  selectMercadoPagoPublicKey,
} from "@/modules/payments/providers/mercadopago/environment";

/**
 * Carrega o MercadoPago.js v2 (Core Methods) sob demanda e expõe apenas a
 * criação de token de cartão. Os dados sensíveis são tokenizados no browser e
 * nunca passam pela nossa API.
 */
export interface CardTokenInput {
  cardNumber: string;
  securityCode: string;
  expirationMonth: string;
  expirationYear: string;
  cardholderName: string;
  identificationType?: string;
  identificationNumber?: string;
}

export interface CardToken {
  id: string;
  payment_method_id?: string;
}

interface MercadoPagoInstance {
  createCardToken(input: CardTokenInput): Promise<CardToken>;
}

interface MercadoPagoConstructor {
  new (publicKey: string, options?: Record<string, unknown>): MercadoPagoInstance;
}

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";

let loader: Promise<MercadoPagoConstructor> | null = null;
const instances = new Map<string, MercadoPagoInstance>();

function loadSdk(): Promise<MercadoPagoConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MercadoPago.js só roda no browser."));
  }
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (loader) return loader;

  loader = new Promise<MercadoPagoConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_URL}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.MercadoPago) resolve(window.MercadoPago);
      else reject(new Error("MercadoPago.js não inicializou."));
    };
    script.onerror = () => reject(new Error("Falha ao carregar MercadoPago.js."));
    if (!existing) document.head.appendChild(script);
  });

  return loader;
}

/** Public Key do ambiente ativo (sandbox usa `TEST-` quando configurada). */
export function getMercadoPagoPublicKey(): string | null {
  const environment = resolveMercadoPagoEnvironment(
    process.env.NEXT_PUBLIC_MERCADOPAGO_ENVIRONMENT,
  );
  return selectMercadoPagoPublicKey({
    environment,
    productionPublicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? null,
    sandboxPublicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_SANDBOX_PUBLIC_KEY ?? null,
  });
}

export async function getMercadoPagoInstance(
  publicKey: string,
): Promise<MercadoPagoInstance> {
  const cached = instances.get(publicKey);
  if (cached) return cached;
  const MercadoPago = await loadSdk();
  const instance = new MercadoPago(publicKey);
  instances.set(publicKey, instance);
  return instance;
}
