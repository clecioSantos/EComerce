"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toggleProductStatusAction } from "@/modules/admin/admin.actions";
import type { ProductStatus } from "@/generated/prisma/enums";

export function ProductStatusSelect({
  productId,
  status,
}: {
  productId: string;
  status: ProductStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(next: string | null) {
    if (next == null) return;
    startTransition(async () => {
      const result = await toggleProductStatusAction(
        productId,
        next as ProductStatus,
      );
      if (result.ok) {
        toast.success("Status atualizado.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao atualizar.");
      }
    });
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger className="h-8 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="DRAFT">Rascunho</SelectItem>
        <SelectItem value="ACTIVE">Ativo</SelectItem>
        <SelectItem value="ARCHIVED">Arquivado</SelectItem>
      </SelectContent>
    </Select>
  );
}
