import type { ShippingOption, ShippingServiceOption } from "./types";

/**
 * Lista de contingência usada quando a API do Melhor Envio não responde (ou não
 * há token). Mantém o painel utilizável; a lista real é buscada em runtime.
 */
export const MELHOR_ENVIO_FALLBACK_SERVICES: ShippingServiceOption[] = [
  { id: "1", name: "PAC", companyName: "Correios" },
  { id: "2", name: "SEDEX", companyName: "Correios" },
  { id: "3", name: ".Package", companyName: "Jadlog" },
  { id: "4", name: ".Com", companyName: "Jadlog" },
  { id: "17", name: "Mini Envios", companyName: "Correios" },
];

/**
 * Junta a lista de serviços disponíveis com os IDs já salvos que não vieram na
 * lista (API indisponível ou serviço descontinuado), para não ocultar/desmarcar
 * configurações existentes no painel.
 */
export function mergeServiceOptions(
  services: ShippingServiceOption[],
  selectedIds: string[],
): ShippingServiceOption[] {
  const byId = new Map(services.map((service) => [service.id, service]));
  for (const id of selectedIds) {
    if (!byId.has(id)) {
      byId.set(id, { id, name: `Serviço ${id} (não listado)` });
    }
  }
  return [...byId.values()];
}

/**
 * Junta as opções cotadas com opções fixas (ex.: retirada na loja), sem
 * duplicar ids. As opções primárias mantêm sua ordem; as extras entram no fim.
 */
export function mergeShippingOptions(
  primary: ShippingOption[],
  extra: ShippingOption[],
): ShippingOption[] {
  const seen = new Set(primary.map((option) => option.id));
  const merged = [...primary];
  for (const option of extra) {
    if (seen.has(option.id)) continue;
    seen.add(option.id);
    merged.push(option);
  }
  return merged;
}
