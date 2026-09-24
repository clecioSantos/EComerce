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
import { createCategoryAction } from "@/modules/admin/admin.actions";
import type { CategoryLike } from "@/modules/categories/tree";

export function CategoryForm({ categories }: { categories: CategoryLike[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("none");

  function submit() {
    startTransition(async () => {
      const result = await createCategoryAction({
        name,
        parentId: parentId === "none" ? null : parentId,
      });
      if (result.ok) {
        toast.success("Categoria criada.");
        setName("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao criar categoria.");
      }
    });
  }

  return (
    <div className="bg-background space-y-4 rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Nova categoria</h2>
      <div className="space-y-2">
        <Label htmlFor="category-name">Nome</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Camisetas"
        />
      </div>
      <div className="space-y-2">
        <Label>Categoria pai</Label>
        <Select
          value={parentId}
          onValueChange={(value) => {
            if (value) setParentId(value);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma (raiz)</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={submit} disabled={pending || name.trim().length < 2}>
        {pending ? "Criando..." : "Criar categoria"}
      </Button>
    </div>
  );
}
