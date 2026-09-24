/**
 * Regras genéricas de variantes.
 *
 * Uma variante é definida por um conjunto de valores de atributos. Nada aqui
 * conhece "cor" ou "tamanho": trabalha apenas com ids de valores de atributo.
 * Isso permite representar:
 *   Camiseta -> Color=Preto, Size=M
 *   Notebook -> RAM=16GB, Storage=512GB
 *   Tênis    -> Color=Branco, Size=42
 */

export interface AttributeValueRef {
  attributeId: string;
  attributeValueId: string;
  /** Rótulo legível (ex.: "Preto"), usado para montar o nome da variante. */
  label?: string;
}

export interface VariantLike {
  id: string;
  sku: string;
  attributeValues: AttributeValueRef[];
  isActive?: boolean;
}

export interface VariantDefiningAttribute {
  id: string;
  name: string;
  isRequired: boolean;
}

export interface VariantSelection {
  attributeId: string;
  attributeValueId: string;
}

/** Assinatura determinística e independente da ordem dos valores. */
export function variantSignature(attributeValueIds: Iterable<string>): string {
  return [...attributeValueIds].sort().join("|");
}

export function buildVariantIndex<T extends VariantLike>(
  variants: T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const variant of variants) {
    const signature = variantSignature(
      variant.attributeValues.map((value) => value.attributeValueId),
    );
    index.set(signature, variant);
  }
  return index;
}

/**
 * Dado o conjunto de valores escolhidos, encontra a variante correspondente.
 * A busca exige correspondência exata (todos os valores da variante presentes).
 */
export function findVariantBySelection<T extends VariantLike>(
  variants: T[],
  selectedValueIds: Iterable<string>,
): T | undefined {
  const signature = variantSignature(selectedValueIds);
  return buildVariantIndex(variants).get(signature);
}

export interface VariantValidation {
  valid: boolean;
  missingAttributeIds: string[];
}

/** Garante que todos os atributos obrigatórios foram escolhidos. */
export function validateVariantSelection(
  definingAttributes: VariantDefiningAttribute[],
  selection: VariantSelection[],
): VariantValidation {
  const selected = new Set(selection.map((item) => item.attributeId));
  const missingAttributeIds = definingAttributes
    .filter((attribute) => attribute.isRequired && !selected.has(attribute.id))
    .map((attribute) => attribute.id);

  return { valid: missingAttributeIds.length === 0, missingAttributeIds };
}

/** Monta o nome legível da variante a partir dos valores escolhidos. */
export function generateVariantName(labels: Iterable<string>): string {
  return [...labels].filter(Boolean).join(" / ");
}

export interface VariantMatrixOption {
  attributeId: string;
  valueIds: string[];
}

/** Gera o produto cartesiano de opções (útil no admin para criar variantes). */
export function buildVariantMatrix(
  options: VariantMatrixOption[],
): string[][] {
  return options.reduce<string[][]>((accumulator, option) => {
    if (option.valueIds.length === 0) return accumulator;
    if (accumulator.length === 0) return option.valueIds.map((id) => [id]);
    const combinations: string[][] = [];
    for (const combination of accumulator) {
      for (const valueId of option.valueIds) {
        combinations.push([...combination, valueId]);
      }
    }
    return combinations;
  }, []);
}

/** Agrupa variantes duplicadas pela combinação de atributos (validação). */
export function findDuplicateVariantSignatures(
  variants: VariantLike[],
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const variant of variants) {
    const signature = variantSignature(
      variant.attributeValues.map((value) => value.attributeValueId),
    );
    if (seen.has(signature)) duplicates.add(signature);
    seen.add(signature);
  }
  return [...duplicates];
}
