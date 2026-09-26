import "server-only";

import { MelhorEnvioClient } from "./client";
import { MelhorEnvioShippingProvider } from "./provider-core";

/** Provider do Melhor Envio com o cliente HTTP real. */
export function createMelhorEnvioProvider(): MelhorEnvioShippingProvider {
  return new MelhorEnvioShippingProvider(new MelhorEnvioClient());
}
