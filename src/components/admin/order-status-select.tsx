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
import { updateOrderStatusAction } from "@/modules/admin/admin.actions";
import type { OrderStatus } from "@/generated/prisma/enums";

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "Aguardando pagamento" },
  { value: "PAID", label: "Pago" },
  { value: "PROCESSING", label: "Em separação" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "DELIVERED", label: "Entregue" },
  { value: "CANCELED", label: "Cancelado" },
  { value: "REFUNDED", label: "Reembolsado" },
  { value: "EXPIRED", label: "Expirado" },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUSES.map((item) => [item.value, item.label]),
);

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(next: string | null) {
    if (next == null) return;
    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, next as OrderStatus);
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
      <SelectTrigger className="h-8 w-44">
        <SelectValue>
          {(value) => STATUS_LABELS[String(value)] ?? "Selecione"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
