"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CartButton({ count }: { count: number }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      render={<Link href="/carrinho" />}
    >
      <ShoppingBag className="size-5" />
      {count > 0 ? (
        <Badge className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
          {count}
        </Badge>
      ) : null}
      <span className="sr-only">Carrinho com {count} itens</span>
    </Button>
  );
}
