"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAddressAction,
  updateAddressAction,
} from "@/modules/customers/address.actions";
import type { CustomerAddressDTO } from "@/modules/customers/types";
import { isValidCep } from "@/modules/shipping/schemas";

interface AddressFormValues {
  label: string;
  recipient: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  isDefault: boolean;
}

function initialValues(address?: CustomerAddressDTO | null): AddressFormValues {
  return {
    label: address?.label ?? "",
    recipient: address?.recipient ?? "",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postalCode: address?.postalCode ?? "",
    phone: address?.phone ?? "",
    isDefault: address?.isDefault ?? false,
  };
}

export function AddressForm({
  address,
  onDone,
}: {
  address?: CustomerAddressDTO | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AddressFormValues>(() => initialValues(address));
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<AddressFormValues>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function submit() {
    if (
      form.recipient.trim().length < 2 ||
      form.line1.trim().length < 3 ||
      form.city.trim().length < 2 ||
      form.state.trim().length < 2
    ) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    if (!isValidCep(form.postalCode)) {
      toast.error("Informe um CEP válido (8 dígitos).");
      return;
    }

    const payload = {
      label: form.label.trim() || null,
      recipient: form.recipient.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim() || null,
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode,
      country: "BR",
      phone: form.phone.trim() || null,
      isDefault: form.isDefault,
    };

    startTransition(async () => {
      const result = address
        ? await updateAddressAction({ ...payload, id: address.id })
        : await createAddressAction(payload);

      if (result.ok) {
        toast.success(address ? "Endereço atualizado." : "Endereço adicionado.");
        onDone?.();
        router.refresh();
      } else {
        toast.error(result.error ?? "Não foi possível salvar o endereço.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="label">Identificação (opcional)</Label>
          <Input
            id="label"
            value={form.label}
            onChange={(event) => update({ label: event.target.value })}
            placeholder="Casa, Trabalho..."
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="recipient">Destinatário *</Label>
          <Input
            id="recipient"
            value={form.recipient}
            onChange={(event) => update({ recipient: event.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="line1">Endereço *</Label>
          <Input
            id="line1"
            value={form.line1}
            onChange={(event) => update({ line1: event.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="line2">Complemento</Label>
          <Input
            id="line2"
            value={form.line2}
            onChange={(event) => update({ line2: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Cidade *</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(event) => update({ city: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">Estado (UF) *</Label>
          <Input
            id="state"
            value={form.state}
            onChange={(event) => update({ state: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">CEP *</Label>
          <Input
            id="postalCode"
            value={form.postalCode}
            onChange={(event) => update({ postalCode: event.target.value })}
            placeholder="01018-020"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(event) => update({ phone: event.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isDefault"
          checked={form.isDefault}
          onCheckedChange={(value) => update({ isDefault: value === true })}
        />
        <Label htmlFor="isDefault">Usar como endereço padrão</Label>
      </div>

      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
        ) : null}
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Salvando..." : address ? "Salvar alterações" : "Adicionar endereço"}
        </Button>
      </div>
    </div>
  );
}
