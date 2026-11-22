"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateInventoryValuesAction } from "@/modules/admin/admin.actions";

interface InventoryAdjustProps {
  variantId: string;
  productName: string;
  sku: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityOnConditional: number;
  quantityQuarantined: number;
  reorderLevel: number;
  allowBackorder: boolean;
}

type QuantityField =
  | "quantityOnHand"
  | "quantityReserved"
  | "quantityOnConditional"
  | "quantityQuarantined"
  | "reorderLevel";

const fields: { key: QuantityField; label: string; description: string }[] = [
  { key: "quantityOnHand", label: "Estoque físico", description: "Total de unidades em estoque." },
  { key: "quantityReserved", label: "Reservado", description: "Unidades comprometidas com pedidos." },
  { key: "quantityOnConditional", label: "Em condicional", description: "Unidades enviadas em condicional." },
  { key: "quantityQuarantined", label: "Em conferência", description: "Unidades indisponíveis até a conferência." },
  { key: "reorderLevel", label: "Estoque mínimo", description: "Limite usado para indicar estoque baixo." },
];

export function InventoryAdjust(props: InventoryAdjustProps) {
  const { variantId, sku, productName, allowBackorder } = props;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const initial = () => ({
    quantityOnHand: String(props.quantityOnHand),
    quantityReserved: String(props.quantityReserved),
    quantityOnConditional: String(props.quantityOnConditional),
    quantityQuarantined: String(props.quantityQuarantined),
    reorderLevel: String(props.reorderLevel),
  });
  const [form, setForm] = useState(initial);
  const [backorder, setBackorder] = useState(allowBackorder);
  const available =
    Number(form.quantityOnHand) - Number(form.quantityReserved) - Number(form.quantityQuarantined);

  function submit() {
    const values = Object.fromEntries(fields.map(({ key }) => [key, Number(form[key])])) as Record<QuantityField, number>;
    if (fields.some(({ key }) => form[key].trim() === "" || !Number.isSafeInteger(values[key]) || values[key] < 0)) {
      toast.error("Informe números inteiros maiores ou iguais a zero.");
      return;
    }
    if (!backorder && available < 0) {
      toast.error("O estoque físico não pode ser inferior ao reservado mais o estoque em conferência.");
      return;
    }
    startTransition(async () => {
      const result = await updateInventoryValuesAction({
        variantId,
        ...values,
        allowBackorder: backorder,
      });
      if (result.ok) {
        toast.success("Estoque atualizado.");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível atualizar o estoque.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return;
      if (next) {
        setForm(initial());
        setBackorder(props.allowBackorder);
      }
      setOpen(next);
    }}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Editar estoque
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar estoque</DialogTitle>
          <DialogDescription>{productName} · SKU {sku}. Altere os valores desejados e salve de uma só vez.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(({ key, label, description }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`${key}-${variantId}`}>{label}</Label>
              <Input
                id={`${key}-${variantId}`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form[key]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                disabled={pending}
              />
              <p className="text-muted-foreground text-xs">{description}</p>
            </div>
          ))}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={backorder}
            onChange={(event) => setBackorder(event.target.checked)}
            disabled={pending}
          />
          <span>Permitir vendas sem estoque (sob encomenda)</span>
        </label>
        <div className="bg-muted/50 rounded-md border px-3 py-2 text-sm">
          <span className="font-medium">Disponível: {Number.isFinite(available) ? available : "—"}</span>
          <p className="text-muted-foreground text-xs">Calculado automaticamente: físico − reservado − em conferência.</p>
        </div>
        <p className="text-muted-foreground text-xs">
          Alterações manuais em reservas e condicionais podem divergir de pedidos e movimentações existentes. Confira os valores antes de salvar.
        </p>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={pending} onClick={submit}>{pending ? "Salvando..." : "Salvar alterações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
