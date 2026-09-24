"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface NavCategory {
  name: string;
  slug: string;
  children: { name: string; slug: string }[];
}

export function MobileMenu({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Menu className="size-5" />
        <span className="sr-only">Abrir menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4 pb-6">
          <Link
            href="/produtos"
            onClick={() => setOpen(false)}
            className="hover:bg-accent rounded-md px-2 py-2 text-sm font-medium"
          >
            Catálogo
          </Link>
          {categories.map((category) => (
            <div key={category.slug} className="flex flex-col">
              <Link
                href={`/categorias/${category.slug}`}
                onClick={() => setOpen(false)}
                className="hover:bg-accent rounded-md px-2 py-2 text-sm font-semibold"
              >
                {category.name}
              </Link>
              {category.children.map((child) => (
                <Link
                  key={child.slug}
                  href={`/categorias/${child.slug}`}
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:bg-accent rounded-md px-4 py-1.5 text-sm"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
