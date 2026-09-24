"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCouponAction } from "@/modules/admin/admin.actions";

export function CouponForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING">(
    "PERCENTAGE",
  );
  const [value, setValue] = useState("10");
  const [minSubtotal, setMinSubtotal] = useState("");

  function submit() {
    startTransition(async () => {
      const result = await createCouponAction({
        code,
        description: null,
        type,
        value: type === "FREE_SHIPPING" ? 0 : Number(value) || 0,
        minSubtotal: minSubtotal ? Number(minSubtotal) : null,
        maxUses: null,
        maxUsesPerUser: null,
        isActive: true,
        startsAt: null,
        endsAt: null,
      });
      if (result.ok) {
        toast.success("Cupom criado.");
        setCode("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao criar cupom.");
      }
    });
  }

  return (
    <div className="bg-background space-y-4 rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Novo cupom</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="coupon-code">Código</Label>
          <Input
            id="coupon-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="BEMVINDO10"
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={type}
            onValueChange={(next) =>
              setType(next as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENTAGE">Percentual</SelectItem>
              <SelectItem value="FIXED_AMOUNT">Valor fixo</SelectItem>
              <SelectItem value="FREE_SHIPPING">Frete grátis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type !== "FREE_SHIPPING" ? (
          <div className="space-y-2">
            <Label htmlFor="coupon-value">
              {type === "PERCENTAGE" ? "Percentual (%)" : "Valor (R$)"}
            </Label>
            <Input
              id="coupon-value"
              type="number"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="coupon-min">Subtotal mínimo (R$)</Label>
          <Input
            id="coupon-min"
            type="number"
            value={minSubtotal}
            onChange={(event) => setMinSubtotal(event.target.value)}
          />
        </div>
      </div>
      <Button onClick={submit} disabled={pending || code.trim().length < 3}>
        {pending ? "Criando..." : "Criar cupom"}
      </Button>
    </div>
  );
}
