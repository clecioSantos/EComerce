import { MissingShippingDataError, ShippingError } from "../errors";
import { onlyDigits, isValidCep } from "../schemas";
import type { ShippingOption, ShippingProvider, ShippingQuoteInput } from "../types";

import { normalizeMelhorEnvioQuotes } from "./normalize";
import { buildMelhorEnvioRequest, collectMissingLogistics } from "./request";
import type { MelhorEnvioCalculator } from "./types";

export const MELHOR_ENVIO_PROVIDER_ID = "melhor-envio";

/** PAC (1) e SEDEX (2) por padrão; sobreponível por configuração da loja. */
export const DEFAULT_MELHOR_ENVIO_SERVICES = ["1", "2"];

/**
 * Provider do Melhor Envio. Recebe um `MelhorEnvioCalculator` por injeção para
 * ser testável sem rede e mantém toda a validação/mapeamento desacoplada do
 * cliente HTTP.
 */
export class MelhorEnvioShippingProvider implements ShippingProvider {
  readonly id = MELHOR_ENVIO_PROVIDER_ID;
  readonly name = "Melhor Envio";

  constructor(
    private readonly calculator: MelhorEnvioCalculator,
    private readonly defaultServices: string[] = DEFAULT_MELHOR_ENVIO_SERVICES,
  ) {}

  async quote(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    const origin = input.origin?.postalCode;
    if (!origin || !isValidCep(origin)) {
      throw new ShippingError(
        "ORIGIN_NOT_CONFIGURED",
        "O endereço de origem da loja não está configurado corretamente.",
      );
    }

    const destination = input.address?.postalCode;
    if (!destination || !isValidCep(destination)) {
      throw new ShippingError("INVALID_POSTAL_CODE", "Informe um CEP de entrega válido.");
    }

    if (input.items.length === 0) return [];

    const missing = collectMissingLogistics(input.items);
    if (missing.length > 0) {
      throw new MissingShippingDataError(missing);
    }

    const services = (
      input.services && input.services.length > 0 ? input.services : this.defaultServices
    )
      .map((service) => service.trim())
      .filter((service) => service.length > 0);

    if (services.length === 0) {
      throw new ShippingError("NO_SERVICES", "Nenhum serviço de frete está habilitado.");
    }

    const request = buildMelhorEnvioRequest({
      originPostalCode: onlyDigits(origin),
      destinationPostalCode: onlyDigits(destination),
      items: input.items,
      services,
    });

    const raw = await this.calculator.calculate(request);
    return normalizeMelhorEnvioQuotes(raw, this.id);
  }
}
