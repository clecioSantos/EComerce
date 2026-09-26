import type { ShippingOption, ShippingProvider } from "../types";

export const PICKUP_PROVIDER_ID = "pickup";
export const PICKUP_OPTION_ID = "pickup-store";

/**
 * Opção de retirada na loja: sempre disponível e com frete grátis. Não depende
 * de CEP de destino nem de cotação externa.
 */
export function pickupShippingOption(): ShippingOption {
  return {
    id: PICKUP_OPTION_ID,
    provider: PICKUP_PROVIDER_ID,
    label: "Retirar na loja",
    description: "Retire seu pedido na loja — frete grátis.",
    companyName: "Loja",
    price: 0,
    estimatedDaysMin: 0,
    estimatedDaysMax: 1,
  };
}

export class PickupShippingProvider implements ShippingProvider {
  readonly id = PICKUP_PROVIDER_ID;
  readonly name = "Retirar na loja";

  async quote(): Promise<ShippingOption[]> {
    return [pickupShippingOption()];
  }
}
