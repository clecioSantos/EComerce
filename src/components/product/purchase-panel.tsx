"use client";

import Link from "next/link";

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
  const canBuy =
    Boolean(selectedVariant?.isActive) && (allowsBackorder || (available ?? 0) > 0);

  function select(attributeId: string, valueId: string) {
    setSelection((current) => ({ ...current, [attributeId]: valueId }));
    setQuantity(1);
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
          className="text-3xl"
        />
      </div>

      {attributes.map((attribute) => (
        <fieldset key={attribute.id} className="space-y-3">
          <legend className="text-sm font-medium">
            {attribute.name}
            <span className="text-muted-foreground ml-2 font-normal">
              {
                attribute.values.find((value) => value.id === selection[attribute.id])
                  ?.value
              }
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {attribute.values.map((value) => {
              const isSelected = selection[attribute.id] === value.id;
              return (
                <Button
                  key={value.id}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="min-h-11 min-w-11 rounded-none px-4"
                  aria-pressed={isSelected}
                  onClick={() => select(attribute.id, value.id)}
                >
                  {value.value}
                </Button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {selectedVariant ? (
        <p className="text-sm">
          {canBuy ? (
            available != null ? (
              <span className="text-muted-foreground">Disponível</span>
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
          className="min-h-12 min-w-48 flex-1 rounded-none"
        >
          <ShoppingBag className="mr-2 size-4" />
          {pending ? "Adicionando..." : "Adicionar ao carrinho"}
        </Button>
      </div>
      {product.conditionalEligible && selectedVariant ? (
        <Link
          href={`/condicional/novo?variante=${selectedVariant.id}`}
          className="block text-center text-sm underline underline-offset-4"
        >
          Solicitar para experimentar no condicional
        </Link>
      ) : null}
      <p className="text-muted-foreground text-sm leading-relaxed">
        As opções de entrega e os valores de frete são consultados no checkout.
      </p>
    </div>
  );
}
