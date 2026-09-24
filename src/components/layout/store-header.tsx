import Link from "next/link";

import { CartButton } from "@/components/layout/cart-button";
import {
  MobileMenu,
  type NavCategory,
} from "@/components/layout/mobile-menu";
import { SearchBar } from "@/components/layout/search-bar";
import { UserMenu, type HeaderUser } from "@/components/layout/user-menu";
import { getCategoryTree } from "@/modules/categories/category.service";

export async function StoreHeader({
  cartCount,
  user,
}: {
  cartCount: number;
  user: HeaderUser | null;
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
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "E-commerce Core";

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4">
        <MobileMenu categories={categories} />
        <Link href="/" className="text-lg font-bold tracking-tight whitespace-nowrap">
          {siteName}
        </Link>
        <SearchBar className="ml-2 hidden max-w-md flex-1 md:block" />
        <div className="ml-auto flex items-center gap-1">
          <CartButton count={cartCount} />
          <UserMenu user={user} />
        </div>
      </div>

      <div className="mx-auto hidden w-full max-w-7xl items-center gap-5 px-4 pb-2 md:flex">
        <Link
          href="/produtos"
          className="text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          Catálogo
        </Link>
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/categorias/${category.slug}`}
            className="text-muted-foreground hover:text-foreground text-sm font-medium"
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
