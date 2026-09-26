"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createPromotionAction,
  deletePromotionAction,
  togglePromotionActiveAction,
  updatePromotionAction,
} from "@/modules/admin/admin.actions";
import type { CategoryLike } from "@/modules/categories/tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";

export interface PromotionDTO {
  id: string;
  name: string;
  description: string | null;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: number;
  scope: "CART" | "CATEGORY" | "PRODUCT";
  categoryId: string | null;
  productId: string | null;
  minSubtotal: number | null;
  minQuantity: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  stackable: boolean;
  priority: number;
}

interface ProductOption {
  id: string;
  name: string;
}

const TYPE_LABELS: Record<PromotionDTO["type"], string> = {
  PERCENTAGE: "Percentual",
  FIXED_AMOUNT: "Valor fixo",
  FREE_SHIPPING: "Frete grátis",
};

const SCOPE_LABELS: Record<PromotionDTO["scope"], string> = {
  CART: "Carrinho",
  CATEGORY: "Categoria",
  PRODUCT: "Produto",
};

interface FormState {
  name: string;
  description: string;
  type: PromotionDTO["type"];
  value: string;
  scope: PromotionDTO["scope"];
  categoryId: string;
  productId: string;
  minSubtotal: string;
  minQuantity: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  stackable: boolean;
  priority: string;
}

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toFormState(promotion?: PromotionDTO | null): FormState {
  return {
    name: promotion?.name ?? "",
    description: promotion?.description ?? "",
    type: promotion?.type ?? "PERCENTAGE",
    value: promotion?.value != null ? String(promotion.value) : "10",
    scope: promotion?.scope ?? "CART",
    categoryId: promotion?.categoryId ?? "none",
    productId: promotion?.productId ?? "none",
    minSubtotal: promotion?.minSubtotal != null ? String(promotion.minSubtotal) : "",
    minQuantity: promotion?.minQuantity != null ? String(promotion.minQuantity) : "",
    startsAt: toDateTimeLocal(promotion?.startsAt ?? null),
    endsAt: toDateTimeLocal(promotion?.endsAt ?? null),
    isActive: promotion?.isActive ?? true,
    stackable: promotion?.stackable ?? true,
    priority: promotion?.priority != null ? String(promotion.priority) : "0",
  };
}

function formatPromotionValue(promotion: PromotionDTO): string {
  if (promotion.type === "PERCENTAGE") return `${promotion.value}%`;
  if (promotion.type === "FREE_SHIPPING") return "Frete grátis";
  return formatCurrency(promotion.value);
}

function PromotionForm({
  promotion,
  categories,
  products,
  onDone,
}: {
  promotion?: PromotionDTO | null;
  categories: CategoryLike[];
  products: ProductOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(promotion));
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function submit() {
    if (form.name.trim().length < 2) {
      toast.error("Informe o nome da promoção.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      value: form.type === "FREE_SHIPPING" ? 0 : Number(form.value) || 0,
      scope: form.scope,
      categoryId:
        form.scope === "CATEGORY" && form.categoryId !== "none" ? form.categoryId : null,
      productId:
        form.scope === "PRODUCT" && form.productId !== "none" ? form.productId : null,
      minSubtotal: form.minSubtotal ? Number(form.minSubtotal) : null,
      minQuantity: form.minQuantity ? Number(form.minQuantity) : null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      isActive: form.isActive,
      stackable: form.stackable,
      priority: Number(form.priority) || 0,
    };

    startTransition(async () => {
      const result = promotion
        ? await updatePromotionAction({ ...payload, id: promotion.id })
        : await createPromotionAction(payload);

      if (result.ok) {
        toast.success(promotion ? "Promoção atualizada." : "Promoção criada.");
        onDone();
        router.refresh();
      } else {
        toast.error(result.error ?? "Não foi possível salvar a promoção.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="Frete grátis acima de R$ 199"
          />
        </div>

        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={form.type}
            onValueChange={(value) => update({ type: value as PromotionDTO["type"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {form.type !== "FREE_SHIPPING" ? (
          <div className="space-y-2">
            <Label htmlFor="value">
              {form.type === "PERCENTAGE" ? "Percentual (%)" : "Valor (R$)"}
            </Label>
            <Input
              id="value"
              type="text"
              inputMode="decimal"
              value={form.value}
              onChange={(event) => update({ value: event.target.value })}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Escopo</Label>
          <Select
            value={form.scope}
            onValueChange={(value) => update({ scope: value as PromotionDTO["scope"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {form.scope === "CATEGORY" ? (
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.categoryId}
              onValueChange={(value) => update({ categoryId: value ?? "none" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {form.scope === "PRODUCT" ? (
          <div className="space-y-2">
            <Label>Produto</Label>
            <Select
              value={form.productId}
              onValueChange={(value) => update({ productId: value ?? "none" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="minSubtotal">Subtotal mínimo (R$)</Label>
          <Input
            id="minSubtotal"
            type="text"
            inputMode="decimal"
            value={form.minSubtotal}
            onChange={(event) => update({ minSubtotal: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minQuantity">Quantidade mínima</Label>
          <Input
            id="minQuantity"
            type="text"
            inputMode="numeric"
            value={form.minQuantity}
            onChange={(event) => update({ minQuantity: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="startsAt">Início</Label>
          <Input
            id="startsAt"
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => update({ startsAt: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endsAt">Fim</Label>
          <Input
            id="endsAt"
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) => update({ endsAt: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Prioridade</Label>
          <Input
            id="priority"
            type="text"
            inputMode="numeric"
            value={form.priority}
            onChange={(event) => update({ priority: event.target.value })}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(event) => update({ description: event.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={form.isActive}
              onCheckedChange={(value) => update({ isActive: value === true })}
            />
            <Label htmlFor="isActive">Ativa</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stackable"
              checked={form.stackable}
              onCheckedChange={(value) => update({ stackable: value === true })}
            />
            <Label htmlFor="stackable">Acumulável</Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Salvando..." : promotion ? "Salvar alterações" : "Criar promoção"}
        </Button>
      </div>
    </div>
  );
}

export function PromotionManager({
  promotions,
  categories,
  products,
}: {
  promotions: PromotionDTO[];
  categories: CategoryLike[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionDTO | null>(null);
  const [deleting, setDeleting] = useState<PromotionDTO | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(promotion: PromotionDTO) {
    setEditing(promotion);
    setFormOpen(true);
  }

  function toggleActive(promotion: PromotionDTO) {
    startTransition(async () => {
      const result = await togglePromotionActiveAction(promotion.id, !promotion.isActive);
      if (result.ok) {
        toast.success(promotion.isActive ? "Promoção desativada." : "Promoção ativada.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao atualizar promoção.");
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deletePromotionAction(deleting.id);
      if (result.ok) {
        toast.success("Promoção excluída.");
        setDeleting(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao excluir promoção.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Aplicadas automaticamente no carrinho/checkout (não exigem cupom).
        </p>
        <Button onClick={openCreate}>Nova promoção</Button>
      </div>

      <div className="bg-background overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Escopo</th>
              <th className="px-4 py-3 font-medium">Mínimo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {promotions.map((promotion) => (
              <tr key={promotion.id}>
                <td className="px-4 py-3 font-medium">{promotion.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{TYPE_LABELS[promotion.type]}</Badge>
                </td>
                <td className="px-4 py-3">{formatPromotionValue(promotion)}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {SCOPE_LABELS[promotion.scope]}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {promotion.minSubtotal != null
                    ? formatCurrency(promotion.minSubtotal)
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {promotion.isActive ? (
                    <Badge>Ativa</Badge>
                  ) : (
                    <Badge variant="destructive">Inativa</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(promotion)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive(promotion)}
                      disabled={pending}
                    >
                      {promotion.isActive ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeleting(promotion)}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {promotions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">
                  Nenhuma promoção cadastrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar promoção" : "Nova promoção"}</DialogTitle>
            <DialogDescription>
              Promoções são aplicadas sem cupom, conforme elegibilidade.
            </DialogDescription>
          </DialogHeader>
          <PromotionForm
            promotion={editing}
            categories={categories}
            products={products}
            onDone={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir promoção</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
