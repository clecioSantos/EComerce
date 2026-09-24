import { MockPaymentProvider } from "./providers/mock.provider";
import type { PaymentProvider } from "./types";

const registry = new Map<string, PaymentProvider>();

export function registerPaymentProvider(provider: PaymentProvider): void {
  registry.set(provider.id, provider);
}

export function getPaymentProvider(id: string): PaymentProvider {
  const provider = registry.get(id);
  if (!provider) {
    throw new Error(`Provedor de pagamento não registrado: "${id}".`);
  }
  return provider;
}

export function listPaymentProviders(): PaymentProvider[] {
  return [...registry.values()];
}

export function hasPaymentProvider(id: string): boolean {
  return registry.has(id);
}

// Registro dos providers disponíveis. Adicione novos providers aqui.
registerPaymentProvider(new MockPaymentProvider());
