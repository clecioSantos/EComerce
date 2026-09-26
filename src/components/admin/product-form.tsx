"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { parseDecimalInput } from "@/lib/format";
import { createProductAction } from "@/modules/admin/admin.actions";
import { buildVariantMatrix } from "@/modules/products/variant";
import type { AttributeDTO, ProductTypeDTO } from "@/modules/products/types";
import type { CategoryLike } from "@/modules/categories/tree";

interface GeneratedVariant {
  attributeValueIds: string[];
  sku: string;
  price: string;
  stock: string;
  weight: string;
  width: string;
  height: string;
  length: string;
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "ARCHIVED", label: "Arquivado" },
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm({
  productTypes,
  categories,
}: {
  productTypes: ProductTypeDTO[];
  categories: CategoryLike[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [productTypeId, setProductTypeId] = useState(productTypes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [descriptionSelection, setDescriptionSelection] = useState<
    Record<string, string>
  >({});
  const [variantSelection, setVariantSelection] = useState<Record<string, string[]>>({});
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);

  const productType = useMemo(
    () => productTypes.find((type) => type.id === productTypeId) ?? null,
    [productTypes, productTypeId],
  );

  const variantAttributes = useMemo<AttributeDTO[]>(
    () =>
      productType?.attributes.filter((attribute) => attribute.isVariantDefining) ?? [],
    [productType],
  );
  const descriptiveAttributes = useMemo<AttributeDTO[]>(
    () =>
      productType?.attributes.filter(
        (attribute) => !attribute.isVariantDefining && attribute.values.length > 0,
      ) ?? [],
    [productType],
  );

  function toggleVariantValue(attributeId: string, valueId: string) {
    setVariantSelection((current) => {
      const values = current[attributeId] ?? [];
      return {
        ...current,
        [attributeId]: values.includes(valueId)
          ? values.filter((id) => id !== valueId)
          : [...values, valueId],
      };
    });
  }

  function generateVariants() {
    if (!productType) return;
    if (variantAttributes.length === 0) {
      toast.error("Este tipo de produto não possui atributos de variante.");
      return;
    }

    const missing = variantAttributes.filter(
      (attribute) =>
        attribute.isRequired && (variantSelection[attribute.id] ?? []).length === 0,
    );
    if (missing.length > 0) {
      toast.error(`Selecione valores para: ${missing.map((a) => a.name).join(", ")}`);
      return;
    }

    const options = variantAttributes
      .filter((attribute) => (variantSelection[attribute.id] ?? []).length > 0)
      .map((attribute) => ({
        attributeId: attribute.id,
        valueIds: variantSelection[attribute.id],
      }));

    const combinations = buildVariantMatrix(options);
    const base = slugify(name || productType.slug);

    const generated: GeneratedVariant[] = combinations.map((valueIds) => ({
      attributeValueIds: valueIds,
      sku: `${base}-${valueIds.slice(-2).join("-")}`.toUpperCase(),
      price: basePrice || "0",
      stock: "0",
      weight: "",
      width: "",
      height: "",
      length: "",
    }));

    setVariants(generated);
    toast.success(`${generated.length} variante(s) gerada(s).`);
  }

  function updateVariant(index: number, patch: Partial<GeneratedVariant>) {
    setVariants((current) =>
      current.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    );
  }

  function handleSubmit() {
    setError(null);
    if (!productType) {
      setError("Selecione um tipo de produto.");
      return;
    }
    if (variants.length === 0) {
      setError("Gere ao menos uma variante.");
      return;
    }

    const slug = slugify(name);
    const image =
      imageUrl.trim().length > 0
        ? imageUrl.trim()
        : `https://picsum.photos/seed/${slug || "produto"}/800/800`;

    startTransition(async () => {
      const result = await createProductAction({
        name,
        slug,
        description: description || null,
        shortDescription: description.slice(0, 120) || null,
        status: status as "DRAFT" | "ACTIVE" | "ARCHIVED",
        productTypeId,
        categoryId: categoryId === "none" ? null : categoryId,
        brandId: null,
        basePrice: parseDecimalInput(basePrice) ?? 0,
        compareAtPrice: parseDecimalInput(compareAtPrice),
        currency: "BRL",
        isFeatured: false,
        metadata: null,
        images: [
          { url: image, alt: name, position: 0, isPrimary: true, variantSku: null },
        ],
        assignments: Object.entries(descriptionSelection).map(
          ([attributeId, attributeValueId]) => ({
            attributeId,
            attributeValueId,
            value: null,
          }),
        ),
        variants: variants.map((variant, index) => ({
          sku: variant.sku,
          name: null,
          price: parseDecimalInput(variant.price) ?? 0,
          compareAtPrice: null,
          weight: parseDecimalInput(variant.weight),
          width: parseDecimalInput(variant.width),
          height: parseDecimalInput(variant.height),
          length: parseDecimalInput(variant.length),
          barcode: null,
          position: index,
          isActive: true,
          attributeValueIds: variant.attributeValueIds,
          inventory: {
            quantityOnHand: Number(variant.stock) || 0,
            reorderLevel: 0,
            allowBackorder: false,
          },
        })),
      });

      if (result.ok) {
        toast.success("Produto criado.");
        router.push("/admin/produtos");
        router.refresh();
      } else {
        setError(result.error ?? "Erro ao criar produto.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="bg-background space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Dados básicos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de produto</Label>
            <Select
              value={productTypeId}
              onValueChange={(value) => {
                if (!value) return;
                setProductTypeId(value);
                setVariantSelection({});
                setDescriptionSelection({});
                setVariants([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {productTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                if (value) setCategoryId(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Camiseta Oversized"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                if (value) setStatus(value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basePrice">Preço base (R$)</Label>
            <Input
              id="basePrice"
              type="text"
              inputMode="decimal"
              step="0.01"
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="compareAtPrice">Preço comparativo (R$)</Label>
            <Input
              id="compareAtPrice"
              type="text"
              inputMode="decimal"
              step="0.01"
              value={compareAtPrice}
              onChange={(event) => setCompareAtPrice(event.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="imageUrl">Imagem (URL)</Label>
            <Input
              id="imageUrl"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
      </section>

      {descriptiveAttributes.length > 0 ? (
        <section className="bg-background space-y-4 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Atributos descritivos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {descriptiveAttributes.map((attribute) => (
              <div key={attribute.id} className="space-y-2">
                <Label>
                  {attribute.name}
                  {attribute.isRequired ? " *" : ""}
                </Label>
                <Select
                  value={descriptionSelection[attribute.id] ?? "none"}
                  onValueChange={(value) => {
                    if (value == null) return;
                    setDescriptionSelection((current) => {
                      const next = { ...current };
                      if (value === "none") delete next[attribute.id];
                      else next[attribute.id] = value;
                      return next;
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informar</SelectItem>
                    {attribute.values.map((value) => (
                      <SelectItem key={value.id} value={value.id}>
                        {value.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bg-background space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">Variantes</h2>
          <p className="text-muted-foreground text-sm">
            Selecione os valores dos atributos de variante e gere as combinações.
          </p>
        </div>

        {variantAttributes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Este tipo de produto não define atributos de variante.
          </p>
        ) : (
          <div className="space-y-4">
            {variantAttributes.map((attribute) => (
              <div key={attribute.id} className="space-y-2">
                <Label>
                  {attribute.name}
                  {attribute.isRequired ? " *" : ""}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {attribute.values.map((value) => {
                    const selected = (variantSelection[attribute.id] ?? []).includes(
                      value.id,
                    );
                    return (
                      <Button
                        key={value.id}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        onClick={() => toggleVariantValue(attribute.id, value.id)}
                      >
                        {value.value}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={generateVariants}>
              Gerar variantes
            </Button>
          </div>
        )}

        {variants.length > 0 ? (
          <>
            <Separator />
            <div className="space-y-3">
              {variants.map((variant, index) => (
                <div
                  key={variant.attributeValueIds.join("-")}
                  className="space-y-3 rounded-md border p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
                    <div className="space-y-2">
                      <Label className="text-xs">Combinação</Label>
                      <Input
                        value={variant.attributeValueIds
                          .map(
                            (id) =>
                              productType?.attributes
                                .flatMap((attribute) => attribute.values)
                                .find((value) => value.id === id)?.value ?? id,
                          )
                          .join(" / ")}
                        readOnly
                        className="text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">SKU</Label>
                      <Input
                        value={variant.sku}
                        onChange={(event) =>
                          updateVariant(index, { sku: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Estoque</Label>
                      <Input
                        type="number"
                        value={variant.stock}
                        onChange={(event) =>
                          updateVariant(index, { stock: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium">
                      Dados para envio
                    </p>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Peso (kg)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          min="0"
                          step="0.001"
                          value={variant.weight}
                          onChange={(event) =>
                            updateVariant(index, { weight: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Largura (cm)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={variant.width}
                          onChange={(event) =>
                            updateVariant(index, { width: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Altura (cm)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={variant.height}
                          onChange={(event) =>
                            updateVariant(index, { height: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Comprimento (cm)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={variant.length}
                          onChange={(event) =>
                            updateVariant(index, { length: event.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/produtos")}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? "Salvando..." : "Criar produto"}
        </Button>
      </div>
    </div>
  );
}
