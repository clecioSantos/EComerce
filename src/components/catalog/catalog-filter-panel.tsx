"use client";

import { SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { CatalogFacets } from "@/modules/catalog/catalog.service";

export function CatalogFilterPanel({
  facets,
  total,
}: {
  facets: CatalogFacets;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const count = [...params.entries()]
    .filter(([key]) => key.startsWith("attr_"))
    .reduce((sum, [, value]) => sum + value.split(",").filter(Boolean).length, 0);
  return (
    <>
      <aside className="hidden md:sticky md:top-44 md:block md:self-start">
        <CatalogFilters facets={facets} />
      </aside>
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="outline" className="w-full justify-between" />}
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" /> Filtrar e ordenar
              {count > 0 ? ` (${count})` : ""}
            </span>
            <span className="text-muted-foreground">{total} produtos</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(100%,24rem)]! gap-0">
            <SheetHeader className="border-b pr-12">
              <SheetTitle>Seu catálogo</SheetTitle>
              <SheetDescription>Os filtros são aplicados ao selecionar.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <CatalogFilters facets={facets} />
            </div>
            <div className="border-t p-4">
              <Button className="w-full" onClick={() => setOpen(false)}>
                Ver {total} produtos
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
