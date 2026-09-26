"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatCurrency } from "@/lib/format";
import type { CartDTO } from "@/modules/cart/types";
import { placeOrderAction } from "@/modules/checkout/checkout.actions";
import { createAddressAction } from "@/modules/customers/address.actions";
import type { CustomerAddressDTO } from "@/modules/customers/types";
import type { PricingResult } from "@/modules/pricing/engine";
import { isValidCep, onlyDigits } from "@/modules/shipping/schemas";
import type { ShippingOption } from "@/modules/shipping/types";

/** Gera uma chave idempotente por tentativa de checkout. */
function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `key_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatDelivery(option: ShippingOption): string | null {
  const { estimatedDaysMin: min, estimatedDaysMax: max } = option;
  if (min != null && max != null && min !== max) return `${min} a ${max} dias úteis`;
  if (min != null || max != null) return `${min ?? max} dias úteis`;
  return null;
}

function formatAddressOption(address: CustomerAddressDTO): string {
  const prefix = address.label ? `${address.label} — ` : "";
  return `${prefix}${address.recipient} · ${address.city}/${address.state}`;
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
  cart,
  pricing,
  couponCode,
  addresses,
  canSaveAddress,
  defaultCustomer,
}: {
  cart: CartDTO;
  /** Preços sem frete (o frete é somado no cliente conforme a seleção). */
  pricing: PricingResult;
  couponCode: string | null;
  addresses: CustomerAddressDTO[];
  canSaveAddress: boolean;
  defaultCustomer: { name: string; email: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [coupon, setCoupon] = useState(couponCode ?? "");
  const [paymentMethod, setPaymentMethod] = useState<FormValues["paymentMethod"]>("PIX");
  const [idempotencyKey] = useState(() => generateIdempotencyKey());
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const defaultAddress =
    addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    defaultAddress?.id ?? "new",
  );
  const [saveAddress, setSaveAddress] = useState(false);
  const { register, handleSubmit, getValues, setValue } = useForm<FormValues>({
    defaultValues: {
      customerName: defaultCustomer.name,
      customerEmail: defaultCustomer.email,
      customerPhone: defaultAddress?.phone ?? "",
      recipient: defaultAddress?.recipient ?? defaultCustomer.name,
      line1: defaultAddress?.line1 ?? "",
      line2: defaultAddress?.line2 ?? "",
      city: defaultAddress?.city ?? "",
      state: defaultAddress?.state ?? "",
      postalCode: defaultAddress?.postalCode ?? "",
      paymentMethod: "PIX",
      notes: "",
    },
  });

  const selectedOption = options.find((option) => option.id === selectedId) ?? null;
  const shippingCost = selectedOption?.price ?? 0;
  const shippingDiscount = pricing.freeShipping ? shippingCost : 0;
  const shippingToPay = shippingCost - shippingDiscount;
  const grandTotal = pricing.grandTotal + shippingToPay;

  function selectAddress(value: string) {
    setSelectedAddressId(value);
    // Endereço mudou: a cotação anterior não vale mais.
    setOptions([]);
    setSelectedId(null);
    setQuoteError(null);
    setSaveAddress(false);

    if (value === "new") {
      setValue("recipient", defaultCustomer.name);
      setValue("line1", "");
      setValue("line2", "");
      setValue("city", "");
      setValue("state", "");
      setValue("postalCode", "");
      return;
    }

    const address = addresses.find((item) => item.id === value);
    if (!address) return;
    setValue("recipient", address.recipient);
    setValue("line1", address.line1);
    setValue("line2", address.line2 ?? "");
    setValue("city", address.city);
    setValue("state", address.state);
    setValue("postalCode", address.postalCode);
  }

  function addressLabel(value: unknown): string {
    if (value == null || value === "new") return "Novo endereço";
    const address = addresses.find((item) => item.id === value);
    return address ? formatAddressOption(address) : "Selecione um endereço";
  }

  function applyCoupon() {
    const params = new URLSearchParams(searchParams.toString());
    if (coupon.trim().length > 0) params.set("coupon", coupon.trim().toUpperCase());
    else params.delete("coupon");
    router.push(`/checkout?${params.toString()}`);
  }

  async function calculateShipping() {
    const cep = onlyDigits(getValues("postalCode") ?? "");
    if (!isValidCep(cep)) {
      setQuoteError("Informe um CEP válido (8 dígitos).");
      return;
    }

    setQuoting(true);
    setQuoteError(null);
    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: cep }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        options?: ShippingOption[];
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setOptions([]);
        setSelectedId(null);
        setQuoteError(data.error ?? "Não foi possível calcular o frete.");
        return;
      }

      setOptions(data.options ?? []);
      setSelectedId(null);
    } catch {
      setOptions([]);
      setSelectedId(null);
      setQuoteError("Não foi possível calcular o frete agora. Tente novamente.");
    } finally {
      setQuoting(false);
    }
  }

  const onSubmit = handleSubmit((values) => {
    if (!selectedId) {
      toast.error("Selecione uma opção de frete.");
      return;
    }

    startTransition(async () => {
      // Salva o novo endereço na conta, quando solicitado (não bloqueia o pedido).
      if (saveAddress && selectedAddressId === "new" && canSaveAddress) {
        const saved = await createAddressAction({
          label: null,
          recipient: values.recipient,
          line1: values.line1,
          line2: values.line2 || null,
          city: values.city,
          state: values.state,
          postalCode: values.postalCode,
          country: "BR",
          phone: values.customerPhone || null,
          isDefault: addresses.length === 0,
        });
        if (saved.ok) toast.success("Endereço salvo na sua conta.");
        else toast.error(saved.error ?? "Não foi possível salvar o endereço.");
      }

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
        shippingOptionId: selectedId,
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
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
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

          {addresses.length > 0 ? (
            <div className="space-y-2">
              <Label>Endereço salvo</Label>
              <Select
                value={selectedAddressId}
                onValueChange={(value) => {
                  if (value) selectAddress(value);
                }}
              >
                <SelectTrigger className="w-full sm:w-96">
                  <SelectValue>{(value) => addressLabel(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((address) => (
                    <SelectItem key={address.id} value={address.id}>
                      {formatAddressOption(address)}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">Novo endereço</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

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

          {canSaveAddress && selectedAddressId === "new" ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="saveAddress"
                checked={saveAddress}
                onCheckedChange={(value) => setSaveAddress(value === true)}
              />
              <Label htmlFor="saveAddress">Salvar este endereço na minha conta</Label>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Entrega</h2>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={calculateShipping}
              disabled={quoting}
            >
              {quoting ? "Calculando..." : "Calcular frete"}
            </Button>
          </div>

          {quoteError ? <p className="text-destructive text-sm">{quoteError}</p> : null}

          {options.length > 0 ? (
            <div className="space-y-2">
              {options.map((option) => {
                const delivery = formatDelivery(option);
                const detail = [option.companyName, delivery].filter(Boolean).join(" · ");
                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => setSelectedId(option.id)}
                    className={`flex w-full items-center justify-between rounded-md border p-3 text-left text-sm transition-colors ${
                      selectedId === option.id ? "border-foreground" : ""
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      {detail ? (
                        <span className="text-muted-foreground block text-xs">
                          {detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-medium">
                      {option.price === 0 ? "Grátis" : formatCurrency(option.price)}
                    </span>
                  </button>
                );
              })}
              {!selectedId ? (
                <p className="text-muted-foreground text-xs">
                  Selecione uma opção de entrega para finalizar o pedido.
                </p>
              ) : null}
            </div>
          ) : !quoteError ? (
            <p className="text-muted-foreground text-sm">
              Informe o CEP e clique em “Calcular frete” para ver as opções.
            </p>
          ) : null}
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

      <aside className="h-fit space-y-4 rounded-lg border p-5 lg:sticky lg:top-24">
        <h2 className="text-sm font-semibold">Resumo do pedido</h2>
        <ul className="space-y-3">
          {cart.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {item.quantity}× {item.productName}
              </span>
              <span>{formatCurrency(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(pricing.subtotal)}</span>
          </div>
          {pricing.promotionsDiscount > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Promoções</span>
              <span>-{formatCurrency(pricing.promotionsDiscount)}</span>
            </div>
          ) : null}
          {pricing.couponDiscount > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cupom {couponCode}</span>
              <span>-{formatCurrency(pricing.couponDiscount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frete</span>
            <span>
              {!selectedOption
                ? "Selecione"
                : shippingCost <= 0
                  ? "Grátis"
                  : formatCurrency(shippingCost)}
            </span>
          </div>
          {shippingDiscount > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frete grátis</span>
              <span>-{formatCurrency(shippingDiscount)}</span>
            </div>
          ) : null}
        </div>
        <Separator />
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
        {couponCode ? (
          <p className="text-muted-foreground text-xs">
            Cupom <strong>{couponCode}</strong> aplicado.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
