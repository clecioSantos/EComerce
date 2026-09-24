export interface CategoryLike {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
}

export interface CategoryNode<T extends CategoryLike = CategoryLike> {
  category: T;
  children: CategoryNode<T>[];
}

/**
 * Constrói uma árvore a partir de uma lista plana. Funciona para qualquer
 * segmento (Moda > Masculino > Camisetas, ou Eletrônicos > Notebooks).
 */
export function buildCategoryTree<T extends CategoryLike>(
  categories: T[],
): CategoryNode<T>[] {
  const nodes = new Map<string, CategoryNode<T>>();
  for (const category of categories) {
    nodes.set(category.id, { category, children: [] });
  }

  const roots: CategoryNode<T>[] = [];
  for (const category of categories) {
    const node = nodes.get(category.id)!;
    if (category.parentId && nodes.has(category.parentId)) {
      nodes.get(category.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: CategoryNode<T>[]) => {
    list.sort((a, b) => {
      if (a.category.position !== b.category.position) {
        return a.category.position - b.category.position;
      }
      return a.category.name.localeCompare(b.category.name);
    });
    list.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);

  return roots;
}

/** Retorna a cadeia de ancestrais (da raiz até o pai imediato). */
export function getAncestors<T extends CategoryLike>(
  categories: T[],
  categoryId: string,
): T[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const ancestors: T[] = [];
  let current = byId.get(categoryId);

  while (current?.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }

  return ancestors;
}

export function getDescendantIds<T extends CategoryLike>(
  categories: T[],
  categoryId: string,
): string[] {
  const childrenByParent = new Map<string, T[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const list = childrenByParent.get(category.parentId) ?? [];
    list.push(category);
    childrenByParent.set(category.parentId, list);
  }

  const result: string[] = [];
  const visit = (id: string) => {
    for (const child of childrenByParent.get(id) ?? []) {
      result.push(child.id);
      visit(child.id);
    }
  };
  visit(categoryId);
  return result;
}
