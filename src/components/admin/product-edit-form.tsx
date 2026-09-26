"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/slug";
import { parseDecimalInput } from "@/lib/format";
import { updateProductAction } from "@/modules/admin/admin.actions";
import type { CategoryLike } from "@/modules/categories/tree";
import type {
  AdminProductEditDTO,
  AdminProductEditVariant,
} from "@/modules/products/product.service";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "ARCHIVED", label: "Arquivado" },
];

interface VariantForm {
  id: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  weight: string;
  width: string;
  height: string;
  length: string;
  barcode: string;
  isActive: boolean;
}

function toValue(value: number | null): string {
  return value == null ? "" : String(value);
}

function mapVariant(variant: AdminProductEditVariant): VariantForm {
  return {
    id: variant.id,
    sku: variant.sku,
    price: toValue(variant.price),
    compareAtPrice: toValue(variant.compareAtPrice),
    weight: toValue(variant.weight),
    width: toValue(variant.width),
    height: toValue(variant.height),
    length: toValue(variant.length),
    barcode: variant.barcode ?? "",
    isActive: variant.isActive,
  };
}

export function ProductEditForm({
  product,
  categories,
}: {
  product: AdminProductEditDTO;
  categories: CategoryLike[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: product.name,
    status: product.status as string,
    categoryId: product.categoryId ?? "none",
    basePrice: toValue(product.basePrice),
    compareAtPrice: toValue(product.compareAtPrice),
    isFeatured: product.isFeatured,
    imageUrl: product.primaryImageUrl ?? "",
    description: product.description ?? "",
    shortDescription: product.shortDescription ?? "",
  });
  const [variants, setVariants] = useState<VariantForm[]>(
    product.variants.map(mapVariant),
  );

  function update(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateVariant(index: number, patch: Partial<VariantForm>) {
    setVariants((current) =>
      current.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    );
  }

  function handleSubmit() {
    setError(null);
    if (form.name.trim().length < 2) {
      setError("Informe o nome do produto.");
      return;
    }

    startTransition(async () => {
      const result = await updateProductAction({
        id: product.id,
        name: form.name.trim(),
        slug: slugify(form.name),
        description: form.description || null,
        shortDescription: form.shortDescription || null,
        status: form.status,
        categoryId: form.categoryId === "none" ? null : form.categoryId,
        brandId: product.brandId,
        basePrice: Number(form.basePrice) || 0,
        compareAtPrice: parseDecimalInput(form.compareAtPrice),
        isFeatured: form.isFeatured,
        primaryImageUrl: form.imageUrl.trim(),
        variants: variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku.trim(),
          name: null,
          price: parseDecimalInput(variant.price),
          compareAtPrice: parseDecimalInput(variant.compareAtPrice),
          weight: parseDecimalInput(variant.weight),
          width: parseDecimalInput(variant.width),
          height: parseDecimalInput(variant.height),
          length: parseDecimalInput(variant.length),
          barcode: variant.barcode.trim() || null,
          isActive: variant.isActive,
        })),
      });

      if (result.ok) {
        toast.success("Produto atualizado.");
        router.push("/admin/produtos");
        router.refresh();
      } else {
        setError(result.error ?? "Erro ao atualizar produto.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="bg-background space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Dados básicos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => {
                if (value) update({ status: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.categoryId}
              onValueChange={(value) => {
                if (value) update({ categoryId: value });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basePrice">Preço base (R$)</Label>
            <Input
              id="basePrice"
              type="text"
              inputMode="decimal"
              step="0.01"
              value={form.basePrice}
              onChange={(event) => update({ basePrice: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="compareAtPrice">Preço comparativo (R$)</Label>
            <Input
              id="compareAtPrice"
              type="text"
              inputMode="decimal"
              step="0.01"
              value={form.compareAtPrice}
              onChange={(event) => update({ compareAtPrice: event.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="isFeatured"
              checked={form.isFeatured}
              onCheckedChange={(value) => update({ isFeatured: value === true })}
            />
            <Label htmlFor="isFeatured">Produto em destaque</Label>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="imageUrl">Imagem principal (URL)</Label>
            <Input
              id="imageUrl"
              value={form.imageUrl}
              onChange={(event) => update({ imageUrl: event.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) => update({ description: event.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="bg-background space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">Variantes</h2>
          <p className="text-muted-foreground text-sm">
            Preços e dados de envio por variante. Deixe o preço vazio para herdar o preço
            base.
          </p>
        </div>

        <div className="space-y-3">
          {variants.map((variant, index) => (
            <div key={variant.id} className="space-y-3 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px_auto]">
                <div className="space-y-2">
                  <Label className="text-xs">SKU</Label>
                  <Input
                    value={variant.sku}
                    onChange={(event) =>
                      updateVariant(index, { sku: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Preço (R$)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    step="0.01"
                    value={variant.price}
                    onChange={(event) =>
                      updateVariant(index, { price: event.target.value })
                    }
                    placeholder="Herdar base"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Preço comparativo</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    step="0.01"
                    value={variant.compareAtPrice}
                    onChange={(event) =>
                      updateVariant(index, { compareAtPrice: event.target.value })
                    }
                  />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <Checkbox
                    checked={variant.isActive}
                    onCheckedChange={(value) =>
                      updateVariant(index, { isActive: value === true })
                    }
                  />
                  <Label className="text-xs">Ativa</Label>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">
                  Dados para envio
                </p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Peso (kg)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      step="0.001"
                      value={variant.weight}
                      onChange={(event) =>
                        updateVariant(index, { weight: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Largura (cm)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={variant.width}
                      onChange={(event) =>
                        updateVariant(index, { width: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Altura (cm)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={variant.height}
                      onChange={(event) =>
                        updateVariant(index, { height: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Comprimento (cm)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={variant.length}
                      onChange={(event) =>
                        updateVariant(index, { length: event.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/produtos")}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
