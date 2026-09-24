"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Price } from "@/components/shared/price";
import { Button } from "@/components/ui/button";
import {
  removeCartItemAction,
  updateCartItemAction,
} from "@/modules/cart/cart.actions";
import type { CartItemDTO } from "@/modules/cart/types";

export function CartItemRow({ item }: { item: CartItemDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const max = item.availableStock && item.availableStock > 0 ? item.availableStock : 99;

  function changeQuantity(quantity: number) {
    startTransition(async () => {
      const result = await updateCartItemAction({ cartItemId: item.id, quantity });
      if (!result.ok) toast.error(result.error ?? "Erro ao atualizar.");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCartItemAction({ cartItemId: item.id });
      if (!result.ok) toast.error(result.error ?? "Erro ao remover.");
      else toast.success("Item removido.");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-4 border-b py-4 last:border-b-0">
      <Link
        href={`/produtos/${item.productSlug}`}
        className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-md"
      >
        {item.image ? (
          <Image src={item.image} alt={item.productName} fill className="object-cover" sizes="80px" />
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1">
        <Link href={`/produtos/${item.productSlug}`} className="text-sm font-medium">
          {item.productName}
        </Link>
        {item.attributes.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            {item.attributes.map((attribute) => attribute.value).join(" / ")}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">SKU {item.sku}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={pending || item.quantity <= 1}
              onClick={() => changeQuantity(item.quantity - 1)}
              aria-label="Diminuir"
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={pending || item.quantity >= max}
              onClick={() => changeQuantity(item.quantity + 1)}
              aria-label="Aumentar"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-8"
            onClick={remove}
            disabled={pending}
            aria-label="Remover item"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="text-right">
        <Price value={item.lineTotal} currency="BRL" className="text-sm" />
      </div>
    </div>
  );
}
