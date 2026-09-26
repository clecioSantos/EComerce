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
import { parseDecimalInput } from "@/lib/format";
import { updateVariantLogisticsAction } from "@/modules/admin/admin.actions";

export interface VariantLogisticsFormProps {
  variantId: string;
  sku: string;
  weight: number | null;
  width: number | null;
  height: number | null;
  length: number | null;
}

function toValue(value: number | null): string {
  return value == null ? "" : String(value);
}

export function VariantLogisticsForm({
  variantId,
  sku,
  weight,
  width,
  height,
  length,
}: VariantLogisticsFormProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    weight: toValue(weight),
    width: toValue(width),
    height: toValue(height),
    length: toValue(length),
  });

  const complete = weight != null && width != null && height != null && length != null;

  function update(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function submit() {
    startTransition(async () => {
      const result = await updateVariantLogisticsAction({
        variantId,
        weight: parseDecimalInput(form.weight),
        width: parseDecimalInput(form.width),
        height: parseDecimalInput(form.height),
        length: parseDecimalInput(form.length),
      });

      if (result.ok) {
        toast.success("Dados de envio salvos.");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Erro ao salvar os dados de envio.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" variant={complete ? "outline" : "secondary"} />}
      >
        {complete ? "Envio" : "Completar envio"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dados para envio</DialogTitle>
          <DialogDescription>
            SKU {sku}. Informe peso (kg) e dimensões (cm) para o cálculo de frete.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`weight-${variantId}`}>Peso (kg)</Label>
            <Input
              id={`weight-${variantId}`}
              type="text"
              inputMode="decimal"
              min="0"
              step="0.001"
              value={form.weight}
              onChange={(event) => update({ weight: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`width-${variantId}`}>Largura (cm)</Label>
            <Input
              id={`width-${variantId}`}
              type="text"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.width}
              onChange={(event) => update({ width: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`height-${variantId}`}>Altura (cm)</Label>
            <Input
              id={`height-${variantId}`}
              type="text"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.height}
              onChange={(event) => update({ height: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`length-${variantId}`}>Comprimento (cm)</Label>
            <Input
              id={`length-${variantId}`}
              type="text"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.length}
              onChange={(event) => update({ length: event.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
