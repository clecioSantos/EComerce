import type { ShippingOption, ShippingProvider } from "../types";

export interface FixedShippingConfig {
  price: number;
  freeAbove?: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
}

/** Cálculo puro, reutilizável e testável. */
export function calculateFixedShipping(
  subtotal: number,
  config: FixedShippingConfig,
): number {
  if (config.freeAbove != null && subtotal >= config.freeAbove) return 0;
  return config.price;
}

export class FixedShippingProvider implements ShippingProvider {
  readonly id = "fixed";
  readonly name = "Entrega padrão";

  constructor(private readonly config: FixedShippingConfig) {}

  async quote(input: {
    subtotal: number;
  }): Promise<ShippingOption[]> {
    return [
      {
        id: "fixed-standard",
        provider: this.id,
        label: this.name,
        description:
          this.config.freeAbove != null
            ? `Frete grátis em compras acima de R$ ${this.config.freeAbove.toFixed(2)}`
            : undefined,
        price: calculateFixedShipping(input.subtotal, this.config),
        estimatedDaysMin: this.config.estimatedDaysMin ?? 3,
        estimatedDaysMax: this.config.estimatedDaysMax ?? 7,
      },
    ];
  }
}
