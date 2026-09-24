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
import { Switch } from "@/components/ui/switch";
import { createAttributeAction } from "@/modules/admin/admin.actions";
import type { ProductTypeDTO } from "@/modules/products/types";

const ATTRIBUTE_TYPES = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "DATE",
  "COLOR",
  "RANGE",
  "DIMENSION",
] as const;

export function AttributeForm({ productTypes }: { productTypes: ProductTypeDTO[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productTypeId, setProductTypeId] = useState(productTypes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ATTRIBUTE_TYPES)[number]>("SELECT");
  const [values, setValues] = useState("");
  const [isVariantDefining, setIsVariantDefining] = useState(false);
  const [isFilterable, setIsFilterable] = useState(false);
  const [isRequired, setIsRequired] = useState(false);

  function submit() {
    startTransition(async () => {
      const result = await createAttributeAction({
        productTypeId,
        name,
        slug: undefined,
        type,
        description: null,
        unit: null,
        isRequired,
        allowMultiple: type === "MULTI_SELECT",
        isFilterable,
        isVariantDefining,
        position: 0,
        metadata: null,
        values: values
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value, index) => ({
            value,
            slug: undefined,
            position: index,
            metadata: null,
          })),
      });
      if (result.ok) {
        toast.success("Atributo criado.");
        setName("");
        setValues("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao criar atributo.");
      }
    });
  }

  return (
    <div className="bg-background space-y-4 rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Novo atributo</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo de produto</Label>
          <Select
            value={productTypeId}
            onValueChange={(value) => {
              if (value) setProductTypeId(value);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {productTypes.map((productType) => (
                <SelectItem key={productType.id} value={productType.id}>
                  {productType.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="attr-name">Nome</Label>
          <Input
            id="attr-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Material"
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={type}
            onValueChange={(value) => setType(value as (typeof ATTRIBUTE_TYPES)[number])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTRIBUTE_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="attr-values">Valores (vírgula)</Label>
          <Input
            id="attr-values"
            value={values}
            onChange={(event) => setValues(event.target.value)}
            placeholder="Algodão, Poliéster"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={isVariantDefining} onCheckedChange={setIsVariantDefining} />
          Define variante
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={isFilterable} onCheckedChange={setIsFilterable} />
          Filtrável
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          Obrigatório
        </label>
      </div>
      <Button
        onClick={submit}
        disabled={pending || name.trim().length < 1 || !productTypeId}
      >
        {pending ? "Criando..." : "Criar atributo"}
      </Button>
    </div>
  );
}
