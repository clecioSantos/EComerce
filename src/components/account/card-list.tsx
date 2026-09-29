"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMercadoPagoInstance } from "@/lib/mercadopago/client";
import {
  deleteCardAction,
  saveCardAction,
  setDefaultCardAction,
} from "@/modules/payments/cards.actions";
import type { SavedCardDTO } from "@/modules/payments/cards.service";
import { onlyDigits } from "@/modules/shipping/schemas";

interface FormState {
  number: string;
  holder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  docType: string;
  docNumber: string;
}

const EMPTY_FORM: FormState = {
  number: "",
  holder: "",
  expiryMonth: "",
  expiryYear: "",
  cvv: "",
  docType: "CPF",
  docNumber: "",
};

function normalizeYear(year: string): string {
  const digits = onlyDigits(year);
  return digits.length === 2 ? `20${digits}` : digits;
}

export function CardList({
  cards,
  mercadoPagoPublicKey,
}: {
  cards: SavedCardDTO[];
  mercadoPagoPublicKey: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [setDefault, setSetDefault] = useState(cards.length === 0);

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function submit() {
    if (!mercadoPagoPublicKey) {
      toast.error("Pagamento indisponível no momento.");
      return;
    }
    if (
      !form.number ||
      !form.cvv ||
      !form.expiryMonth ||
      !form.expiryYear ||
      !form.holder
    ) {
      toast.error("Preencha os dados do cartão.");
      return;
    }

    startTransition(async () => {
      try {
        const mp = await getMercadoPagoInstance(mercadoPagoPublicKey);
        const token = await mp.createCardToken({
          cardNumber: onlyDigits(form.number),
          securityCode: form.cvv,
          expirationMonth: form.expiryMonth.padStart(2, "0"),
          expirationYear: normalizeYear(form.expiryYear),
          cardholderName: form.holder,
          identificationType: form.docNumber ? form.docType : undefined,
          identificationNumber: form.docNumber ? onlyDigits(form.docNumber) : undefined,
        });

        const result = await saveCardAction({ token: token.id, setDefault });
        if (result.ok) {
          toast.success("Cartão salvo.");
          setForm(EMPTY_FORM);
          setShowForm(false);
          router.refresh();
        } else {
          toast.error(result.error ?? "Não foi possível salvar o cartão.");
        }
      } catch (error) {
        console.error("[cartões] erro ao salvar cartão:", error);
        toast.error(
          error instanceof Error
            ? `Cartão inválido: ${error.message}`
            : "Não foi possível validar o cartão.",
        );
      }
    });
  }

  function remove(cardId: string) {
    startTransition(async () => {
      const result = await deleteCardAction(cardId);
      if (result.ok) {
        toast.success("Cartão removido.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Não foi possível remover.");
      }
    });
  }

  function makeDefault(cardId: string) {
    startTransition(async () => {
      const result = await setDefaultCardAction(cardId);
      if (result.ok) {
        toast.success("Cartão padrão atualizado.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Não foi possível atualizar.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Cartões salvos</h2>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancelar" : "Adicionar cartão"}
        </Button>
      </div>

      {cards.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhum cartão salvo. O código de segurança (CVV) nunca é armazenado.
        </p>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="font-medium">
                  {card.brand ?? "Cartão"} •••• {card.lastFourDigits}
                </span>
                {card.expirationMonth && card.expirationYear ? (
                  <span className="text-muted-foreground text-xs">
                    {String(card.expirationMonth).padStart(2, "0")}/
                    {String(card.expirationYear).slice(-2)}
                  </span>
                ) : null}
                {card.isDefault ? <Badge variant="secondary">Padrão</Badge> : null}
              </span>
              <span className="flex gap-1">
                {!card.isDefault ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => makeDefault(card.id)}
                    disabled={pending}
                  >
                    Tornar padrão
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove(card.id)}
                  disabled={pending}
                >
                  Remover
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="space-y-3 rounded-md border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="new-card-number">Número do cartão</Label>
              <Input
                id="new-card-number"
                inputMode="numeric"
                autoComplete="cc-number"
                value={form.number}
                onChange={(event) => update({ number: event.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="new-card-holder">Nome impresso no cartão</Label>
              <Input
                id="new-card-holder"
                autoComplete="cc-name"
                value={form.holder}
                onChange={(event) => update({ holder: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-card-exp">Validade (MM/AA)</Label>
              <div className="flex gap-2">
                <Input
                  id="new-card-exp"
                  placeholder="MM"
                  maxLength={2}
                  value={form.expiryMonth}
                  onChange={(event) => update({ expiryMonth: event.target.value })}
                />
                <Input
                  placeholder="AA"
                  maxLength={2}
                  value={form.expiryYear}
                  onChange={(event) => update({ expiryYear: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-card-cvv">CVV</Label>
              <Input
                id="new-card-cvv"
                inputMode="numeric"
                maxLength={4}
                autoComplete="cc-csc"
                value={form.cvv}
                onChange={(event) => update({ cvv: event.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="new-card-doc">CPF/CNPJ do titular</Label>
              <Input
                id="new-card-doc"
                inputMode="numeric"
                value={form.docNumber}
                onChange={(event) => update({ docNumber: event.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="new-card-default"
              checked={setDefault}
              onCheckedChange={(value) => setSetDefault(value === true)}
            />
            <Label htmlFor="new-card-default">Definir como padrão</Label>
          </div>
          <p className="text-muted-foreground text-xs">
            Os dados do cartão são tokenizados pelo Mercado Pago no seu navegador. O CVV
            não é armazenado.
          </p>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Salvando..." : "Salvar cartão"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
