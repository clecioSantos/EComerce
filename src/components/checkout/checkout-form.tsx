"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { placeOrderAction } from "@/modules/checkout/checkout.actions";
import type { ShippingOption } from "@/modules/shipping/types";

/** Gera uma chave idempotente por tentativa de checkout. */
function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `key_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

interface FormValues {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  recipient: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  paymentMethod: "PIX" | "CREDIT_CARD" | "BOLETO";
  notes: string;
}

export function CheckoutForm({
  shippingOptions,
  selectedShippingId,
  couponCode,
  defaultCustomer,
}: {
  shippingOptions: ShippingOption[];
  selectedShippingId: string | null;
  couponCode: string | null;
  defaultCustomer: { name: string; email: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [coupon, setCoupon] = useState(couponCode ?? "");
  const [paymentMethod, setPaymentMethod] =
    useState<FormValues["paymentMethod"]>("PIX");
  const [idempotencyKey] = useState(() => generateIdempotencyKey());
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      customerName: defaultCustomer.name,
      customerEmail: defaultCustomer.email,
      customerPhone: "",
      recipient: defaultCustomer.name,
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      paymentMethod: "PIX",
      notes: "",
    },
  });

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`/checkout?${params.toString()}`);
  }

  function applyCoupon() {
    pushParams((params) => {
      if (coupon.trim().length > 0) params.set("coupon", coupon.trim().toUpperCase());
      else params.delete("coupon");
    });
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await placeOrderAction({
        customer: {
          name: values.customerName,
          email: values.customerEmail,
          phone: values.customerPhone || null,
        },
        shippingAddress: {
          recipient: values.recipient,
          line1: values.line1,
          line2: values.line2 || null,
          city: values.city,
          state: values.state,
          postalCode: values.postalCode,
          country: "BR",
          phone: values.customerPhone || null,
        },
        shippingOptionId: selectedShippingId ?? shippingOptions[0]?.id ?? "",
        paymentMethod,
        couponCode: couponCode,
        notes: values.notes || null,
        idempotencyKey,
      });

      if (result.ok && result.orderId) {
        toast.success("Pedido realizado!");
        router.push(`/checkout/sucesso?orderId=${result.orderId}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Não foi possível concluir o pedido.");
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Seus dados</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">Nome completo</Label>
            <Input id="customerName" required {...register("customerName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerEmail">E-mail</Label>
            <Input
              id="customerEmail"
              type="email"
              required
              {...register("customerEmail")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Telefone</Label>
            <Input id="customerPhone" {...register("customerPhone")} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Endereço de entrega</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="recipient">Destinatário</Label>
            <Input id="recipient" required {...register("recipient")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="line1">Endereço</Label>
            <Input id="line1" required {...register("line1")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="line2">Complemento</Label>
            <Input id="line2" {...register("line2")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" required {...register("city")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Input id="state" required {...register("state")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">CEP</Label>
            <Input id="postalCode" required {...register("postalCode")} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Entrega</h2>
        <div className="space-y-2">
          {shippingOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() =>
                pushParams((params) => params.set("shippingOptionId", option.id))
              }
              className={`flex w-full items-center justify-between rounded-md border p-3 text-left text-sm transition-colors ${
                selectedShippingId === option.id ? "border-foreground" : ""
              }`}
            >
              <span>
                <span className="block font-medium">{option.label}</span>
                {option.description ? (
                  <span className="text-muted-foreground block text-xs">
                    {option.description}
                  </span>
                ) : null}
              </span>
              <span className="font-medium">
                {option.price === 0 ? "Grátis" : formatCurrency(option.price)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Pagamento</h2>
        <Select
          value={paymentMethod}
          onValueChange={(value) => {
            if (value) setPaymentMethod(value as FormValues["paymentMethod"]);
          }}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PIX">PIX</SelectItem>
            <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
            <SelectItem value="BOLETO">Boleto</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Pagamento simulado (provider de desenvolvimento). Nenhuma cobrança real é
          feita.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Cupom</h2>
        <div className="flex gap-2">
          <Input
            value={coupon}
            onChange={(event) => setCoupon(event.target.value)}
            placeholder="Código do cupom"
          />
          <Button type="button" variant="secondary" onClick={applyCoupon}>
            Aplicar
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" {...register("notes")} />
      </section>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Processando..." : "Finalizar pedido"}
      </Button>
    </form>
  );
}
