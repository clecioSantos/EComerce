"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adjustInventoryAction } from "@/modules/admin/admin.actions";

export function InventoryAdjust({ variantId }: { variantId: string }) {
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState("");

  function submit(sign: 1 | -1) {
    const delta = (Number(quantity) || 0) * sign;
    if (delta === 0) {
      toast.error("Informe uma quantidade.");
      return;
    }
    startTransition(async () => {
      const result = await adjustInventoryAction({
        variantId,
        quantity: delta,
        reason: sign > 0 ? "Entrada manual (admin)" : "Saída manual (admin)",
      });
      if (result.ok) {
        toast.success("Estoque ajustado.");
        setQuantity("");
      } else {
        toast.error(result.error ?? "Erro ao ajustar.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        className="h-8 w-20"
        placeholder="0"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => submit(1)}
      >
        +
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => submit(-1)}
      >
        −
      </Button>
    </div>
  );
}
