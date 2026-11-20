"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conditionalAction } from "@/modules/conditional/actions";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { ShippingOption } from "@/modules/shipping/types";

type Variant = { id: string; label: string; price: number; available: number };
export function RequestForm({
  variants,
  addresses,
  terms,
  termsVersion,
  freightPolicy,
  returnFee,
  customerPaysShipping,
  selected = "",
  customerId,
}: {
  variants: Variant[];
  addresses: { id: string; label: string }[];
  terms: string;
  termsVersion: number;
  freightPolicy: string;
  returnFee: number;
  customerPaysShipping: boolean;
  selected?: string;
  customerId?: string;
}) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const key = useRef<string | null>(null);
  const router = useRouter();
  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const button = (e.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        const quote = button?.value === "quote";
        const values = Object.fromEntries(
          new FormData(e.currentTarget).entries(),
        ) as Record<string, string>;
        if (!quote) {
          key.current ??= crypto.randomUUID();
          values.key = key.current;
          values.termsVersion = String(termsVersion);
        }
        if (customerId) values.customerId = customerId;
        setError("");
        start(async () => {
          const r = await conditionalAction({
            operation: customerId
              ? quote
                ? "adminQuote"
                : "adminRequest"
              : quote
                ? "quote"
                : "request",
            values,
          });
          if (!r.ok) {
            setError(r.error);
            return;
          }
          if ("options" in r && r.options) setOptions(r.options);
          if ("id" in r && r.id)
            router.push(
              `${customerId ? "/admin/condicionais" : "/conta/condicionais"}/${r.id}`,
            );
        });
      }}
    >
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Sua sacola de condicional</h2>
        <p className="text-muted-foreground text-sm">
          Informe a quantidade das variantes desejadas. A loja ainda precisa aprovar a
          solicitação.
        </p>
        <div className="divide-y rounded-lg border">
          {variants.map((v) => (
            <label
              className="grid grid-cols-[1fr_5rem] items-center gap-4 p-4 text-sm"
              key={v.id}
            >
              <span>
                {v.label}
                <span className="text-muted-foreground mt-1 block">
                  {formatCurrency(v.price)} · {Math.max(0, v.available)} disponível(is)
                </span>
              </span>
              <input
                name={`qty:${v.id}`}
                aria-label={`Quantidade de ${v.label}`}
                type="number"
                min="0"
                max={Math.max(0, Math.min(100, v.available))}
                defaultValue={selected === v.id && v.available > 0 ? 1 : 0}
                className="bg-background min-h-11 w-full rounded border p-2"
                onChange={() => setOptions([])}
              />
            </label>
          ))}
        </div>
      </section>
      <label className="grid gap-2 text-sm">
        Endereço de recebimento
        <select
          name="addressId"
          className="bg-background min-h-11 rounded border p-2"
          required
          onChange={() => setOptions([])}
        >
          <option value="">Selecione</option>
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Entrega e devolução</h2>
        <p className="text-sm leading-relaxed whitespace-pre-line">{freightPolicy}</p>
        <p className="text-sm">
          Taxa de retorno prevista, caso haja devolução:{" "}
          <strong>{formatCurrency(returnFee)}</strong>.{" "}
          {customerPaysShipping
            ? "O frete de ida selecionado será incluído no acerto."
            : "A loja assume o frete de ida."}
        </p>
        <Button type="submit" value="quote" variant="outline" disabled={pending}>
          {pending ? "Consultando…" : "Consultar entrega"}
        </Button>
        {options.length ? (
          <label className="grid gap-2 text-sm">
            Forma de recebimento
            <select
              name="shippingOptionId"
              className="bg-background min-h-11 rounded border p-2"
              required
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} — {formatCurrency(customerPaysShipping ? o.price : 0)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Condições do condicional</h2>
        <div className="max-h-72 overflow-y-auto rounded border p-4 text-sm leading-relaxed whitespace-pre-line">
          {terms}
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="accepted" className="mt-1 size-5" />
          Li e aceito as condições, os prazos e os custos informados acima.
        </label>
      </section>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" value="request" disabled={pending || !options.length}>
        Solicitar condicional
      </Button>
    </form>
  );
}
