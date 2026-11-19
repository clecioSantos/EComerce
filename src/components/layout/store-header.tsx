import Link from "next/link";
import type { AppearanceInput } from "@/modules/settings/appearance";

import { CartButton } from "@/components/layout/cart-button";
import { MobileMenu, type NavCategory } from "@/components/layout/mobile-menu";
import { SearchBar } from "@/components/layout/search-bar";
import { UserMenu, type HeaderUser } from "@/components/layout/user-menu";
import { getCategoryTree } from "@/modules/categories/category.service";

export async function StoreHeader({
  cartCount,
  user,
  appearance,
}: {
  cartCount: number;
  user: HeaderUser | null;
  appearance: AppearanceInput;
}) {
  const tree = await getCategoryTree();
  const categories: NavCategory[] = tree.map((node) => ({
    name: node.category.name,
    slug: node.category.slug,
    children: node.children.map((child) => ({
      name: child.category.name,
      slug: child.category.slug,
    })),
  }));

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/90 sticky top-0 z-40 w-full border-b shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center gap-2 px-3 py-2 sm:min-h-24 sm:gap-4 sm:px-4">
        <MobileMenu categories={categories} />
        <Link
          href="/"
          className="focus-visible:outline-primary flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 md:flex-none md:gap-3"
          aria-label={appearance.name}
        >
          {appearance.logoUrl ? (
            <img
              src={appearance.logoUrl}
              alt={`Logotipo de ${appearance.name}`}
              className="h-10 w-auto max-w-20 shrink object-contain sm:h-14 sm:max-w-36 lg:h-16 lg:max-w-52"
            />
          ) : (
            <span className="bg-primary text-primary-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold shadow-sm sm:size-14 sm:text-xl">
              {appearance.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-primary min-w-0 truncate text-sm font-extrabold tracking-tight sm:max-w-56 sm:text-xl">
            {appearance.name}
          </span>
        </Link>
        <SearchBar className="ml-4 hidden max-w-xl flex-1 md:block" />
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
          <CartButton count={cartCount} />
          <UserMenu user={user} />
        </div>
      </div>

      <div className="border-border/60 border-t">
        <nav
          aria-label="Categorias da loja"
          className="mx-auto hidden min-h-11 w-full max-w-7xl items-center gap-6 overflow-x-auto px-4 md:flex"
        >
          <Link
            href="/produtos"
            className="text-primary py-3 text-sm font-medium hover:underline hover:underline-offset-4"
          >
            Catálogo
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/categorias/${category.slug}`}
              className="text-foreground/75 hover:text-primary py-3 text-sm font-medium whitespace-nowrap transition-colors"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
