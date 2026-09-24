export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Gera um slug único dentro de uma lista de slugs existentes. */
export function uniqueSlug(base: string, existing: Iterable<string>): string {
  const slug = slugify(base);
  const taken = new Set(existing);
  if (!taken.has(slug)) return slug;

  let counter = 2;
  let candidate = `${slug}-${counter}`;
  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${slug}-${counter}`;
  }
  return candidate;
}
