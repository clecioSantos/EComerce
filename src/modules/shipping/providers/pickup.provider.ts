import type { ShippingOption, ShippingProvider } from "../types";

export class PickupShippingProvider implements ShippingProvider {
  readonly id = "pickup";
  readonly name = "Retirada na loja";

  async quote(): Promise<ShippingOption[]> {
    return [
      {
        id: "pickup-store",
        provider: this.id,
        label: this.name,
        description: "Retire seu pedido na loja mais próxima.",
        price: 0,
        estimatedDaysMin: 1,
        estimatedDaysMax: 1,
      },
    ];
  }
}
