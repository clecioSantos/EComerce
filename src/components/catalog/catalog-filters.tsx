"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { CatalogFacets } from "@/modules/catalog/catalog.service";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevância" },
  { value: "newest", label: "Mais recentes" },
  { value: "price-asc", label: "Menor preço" },
  { value: "price-desc", label: "Maior preço" },
];

export function CatalogFilters({ facets }: { facets: CatalogFacets }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page");
      const query = params.toString();
      router.push(query.length > 0 ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const toggleValue = useCallback(
    (attributeSlug: string, valueId: string) => {
      updateParams((params) => {
        const key = `attr_${attributeSlug}`;
        const current = params.get(key)?.split(",").filter(Boolean) ?? [];
        const next = current.includes(valueId)
          ? current.filter((id) => id !== valueId)
          : [...current, valueId];
        if (next.length > 0) params.set(key, next.join(","));
        else params.delete(key);
      });
    },
    [updateParams],
  );

  const sort = searchParams.get("sort") ?? "relevance";
  const hasFilters =
    searchParams.toString().length > 0 && searchParams.get("page") !== "1";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Filtros</h2>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(pathname)}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Ordenar por</Label>
        <Select
          value={sort}
          onValueChange={(value) => {
            if (value == null) return;
            updateParams((params) => params.set("sort", value));
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {facets.attributes.length > 0 ? <Separator /> : null}

      {facets.attributes.map((facet) => {
        const selected =
          searchParams.get(`attr_${facet.slug}`)?.split(",").filter(Boolean) ??
          [];

        return (
          <div key={facet.attributeId} className="space-y-3">
            <p className="text-sm font-medium">{facet.name}</p>
            <div className="space-y-2">
              {facet.values.map((value) => {
                const checked = selected.includes(value.id);
                return (
                  <label
                    key={value.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleValue(facet.slug, value.id)}
                    />
                    <span>{value.value}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
