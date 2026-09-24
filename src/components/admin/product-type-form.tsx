"use client";

import { Plus, Trash2 } from "lucide-react";
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
import { createProductTypeAction } from "@/modules/admin/admin.actions";

interface AttributeDraft {
  name: string;
  type: string;
  values: string;
  isVariantDefining: boolean;
  isFilterable: boolean;
  isRequired: boolean;
}

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
];

function emptyAttribute(): AttributeDraft {
  return {
    name: "",
    type: "SELECT",
    values: "",
    isVariantDefining: false,
    isFilterable: false,
    isRequired: false,
  };
}

export function ProductTypeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [attributes, setAttributes] = useState<AttributeDraft[]>([
    { ...emptyAttribute(), name: "Cor", isVariantDefining: true, isFilterable: true },
  ]);

  function update(index: number, patch: Partial<AttributeDraft>) {
    setAttributes((current) =>
      current.map((attribute, i) => (i === index ? { ...attribute, ...patch } : attribute)),
    );
  }

  function submit() {
    startTransition(async () => {
      const result = await createProductTypeAction({
        name,
        slug: undefined,
        description: description || null,
        icon: null,
        isActive: true,
        attributes: attributes
          .filter((attribute) => attribute.name.trim().length > 0)
          .map((attribute, index) => ({
            name: attribute.name,
            type: attribute.type as
              | "TEXT"
              | "NUMBER"
              | "BOOLEAN"
              | "SELECT"
              | "MULTI_SELECT"
              | "DATE"
              | "COLOR"
              | "RANGE"
              | "DIMENSION",
            slug: undefined,
            description: null,
            unit: null,
            isRequired: attribute.isRequired,
            allowMultiple: attribute.type === "MULTI_SELECT",
            isFilterable: attribute.isFilterable,
            isVariantDefining: attribute.isVariantDefining,
            position: index,
            metadata: null,
            values: attribute.values
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
              .map((value, valueIndex) => ({
                value,
                slug: undefined,
                position: valueIndex,
                metadata: null,
              })),
          })),
      });

      if (result.ok) {
        toast.success("Tipo de produto criado.");
        setName("");
        setDescription("");
        setAttributes([emptyAttribute()]);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao criar tipo de produto.");
      }
    });
  }

  return (
    <div className="bg-background space-y-5 rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Novo tipo de produto</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type-name">Nome</Label>
          <Input
            id="type-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Roupas"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type-description">Descrição</Label>
          <Input
            id="type-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Atributos</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAttributes((current) => [...current, emptyAttribute()])}
          >
            <Plus className="mr-1 size-4" />
            Atributo
          </Button>
        </div>

        {attributes.map((attribute, index) => (
          <div key={index} className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_1fr_auto]">
              <Input
                value={attribute.name}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder="Nome (ex.: Cor)"
              />
              <Select
                value={attribute.type}
                onValueChange={(value) => {
                  if (value) update(index, { type: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTRIBUTE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={attribute.values}
                onChange={(event) => update(index, { values: event.target.value })}
                placeholder="Valores separados por vírgula"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setAttributes((current) => current.filter((_, i) => i !== index))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={attribute.isVariantDefining}
                  onCheckedChange={(checked) =>
                    update(index, { isVariantDefining: checked })
                  }
                />
                Define variante
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={attribute.isFilterable}
                  onCheckedChange={(checked) => update(index, { isFilterable: checked })}
                />
                Filtrável
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={attribute.isRequired}
                  onCheckedChange={(checked) => update(index, { isRequired: checked })}
                />
                Obrigatório
              </label>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={submit} disabled={pending || name.trim().length < 2}>
        {pending ? "Criando..." : "Criar tipo de produto"}
      </Button>
    </div>
  );
}
