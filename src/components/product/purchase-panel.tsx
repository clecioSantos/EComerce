"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Price } from "@/components/shared/price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { addToCartAction } from "@/modules/cart/cart.actions";
import { findVariantBySelection } from "@/modules/products/variant";
import type { ProductDetailDTO } from "@/modules/products/types";

interface AttributeOption {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}

export function PurchasePanel({ product }: { product: ProductDetailDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const attributes = useMemo<AttributeOption[]>(() => {
    const map = new Map<string, AttributeOption>();
    for (const variant of product.variants) {
      for (const attribute of variant.attributes) {
        if (!map.has(attribute.attributeId)) {
          map.set(attribute.attributeId, {
            id: attribute.attributeId,
            name: attribute.attributeName,
            values: [],
          });
        }
        const option = map.get(attribute.attributeId)!;
        if (!option.values.some((value) => value.id === attribute.valueId)) {
          option.values.push({ id: attribute.valueId, value: attribute.value });
        }
      }
    }
    return [...map.values()];
  }, [product.variants]);

  const firstAvailable =
    product.variants.find(
      (variant) =>
        variant.isActive &&
        (variant.inventory?.available ?? 0) > 0 &&
        variant.attributes.length === attributes.length,
    ) ?? product.variants[0];

  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const attribute of firstAvailable?.attributes ?? []) {
      initial[attribute.attributeId] = attribute.valueId;
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);

  const variantIndex = useMemo(
    () =>
      product.variants.map((variant) => ({
        ...variant,
        attributeValues: variant.attributes.map((attribute) => ({
          attributeId: attribute.attributeId,
          attributeValueId: attribute.valueId,
        })),
      })),
    [product.variants],
  );

  const selectedVariant = useMemo(() => {
    const valueIds = Object.values(selection);
    if (valueIds.length === 0) return null;
    return findVariantBySelection(variantIndex, valueIds) ?? null;
  }, [variantIndex, selection]);

  const available = selectedVariant?.inventory?.available ?? null;
  const allowsBackorder = selectedVariant?.inventory?.allowBackorder ?? false;
  const canBuy = Boolean(selectedVariant) && (allowsBackorder || (available ?? 0) > 0);

  function select(attributeId: string, valueId: string) {
    setSelection((current) => ({ ...current, [attributeId]: valueId }));
  }

  function handleAdd() {
    if (!selectedVariant) {
      toast.error("Selecione todas as opções.");
      return;
    }
    startTransition(async () => {
      const result = await addToCartAction({ variantId: selectedVariant.id, quantity });
      if (result.ok) {
        toast.success("Produto adicionado ao carrinho.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Não foi possível adicionar.");
      }
    });
  }

  const maxQuantity = available && available > 0 ? Math.min(available, 99) : 99;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Price
          value={selectedVariant?.price ?? product.basePrice}
          compareAt={selectedVariant?.compareAtPrice ?? product.compareAtPrice}
          currency={product.currency}
          className="text-2xl"
        />
        {selectedVariant ? (
          <p className="text-muted-foreground text-xs">SKU {selectedVariant.sku}</p>
        ) : null}
      </div>

      {attributes.map((attribute) => (
        <div key={attribute.id} className="space-y-2">
          <p className="text-sm font-medium">{attribute.name}</p>
          <div className="flex flex-wrap gap-2">
            {attribute.values.map((value) => {
              const isSelected = selection[attribute.id] === value.id;
              return (
                <Button
                  key={value.id}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => select(attribute.id, value.id)}
                >
                  {value.value}
                </Button>
              );
            })}
          </div>
        </div>
      ))}

      {selectedVariant ? (
        <p className="text-sm">
          {canBuy ? (
            available != null ? (
              <span className="text-muted-foreground">
                {available} em estoque
              </span>
            ) : null
          ) : (
            <Badge variant="secondary">Esgotado</Badge>
          )}
        </p>
      ) : null}

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={quantity <= 1}
            aria-label="Diminuir quantidade"
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-10 text-center text-sm">{quantity}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
            disabled={quantity >= maxQuantity}
            aria-label="Aumentar quantidade"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={handleAdd}
          disabled={!canBuy || pending}
          className="flex-1"
        >
          <ShoppingBag className="mr-2 size-4" />
          {pending ? "Adicionando..." : "Adicionar ao carrinho"}
        </Button>
      </div>
    </div>
  );
}
