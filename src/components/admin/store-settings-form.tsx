"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStoreSettingsAction } from "@/modules/admin/admin.actions";
import { mergeServiceOptions } from "@/modules/shipping/services";
import { isValidCep, onlyDigits } from "@/modules/shipping/schemas";
import type { ShippingServiceOption } from "@/modules/shipping/types";

export interface StoreSettingsFormInitial {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  shippingServiceIds: string[];
}

const EMPTY: StoreSettingsFormInitial = {
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  shippingServiceIds: ["1", "2"],
};

export function StoreSettingsForm({
  initial,
  services,
  serviceSource,
}: {
  initial: StoreSettingsFormInitial | null;
  services: ShippingServiceOption[];
  serviceSource: "api" | "fallback";
}) {
  const [form, setForm] = useState<StoreSettingsFormInitial>(initial ?? EMPTY);
  const [pending, startTransition] = useTransition();

  const serviceOptions = mergeServiceOptions(services, form.shippingServiceIds);

  function update(patch: Partial<StoreSettingsFormInitial>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function toggleService(id: string, checked: boolean) {
    setForm((current) => {
      const selected = new Set(current.shippingServiceIds);
      if (checked) selected.add(id);
      else selected.delete(id);
      return { ...current, shippingServiceIds: [...selected] };
    });
  }

  function handleSubmit() {
    const postalCode = onlyDigits(form.postalCode);
    if (!isValidCep(postalCode)) {
      toast.error("Informe um CEP de origem válido (8 dígitos).");
      return;
    }

    startTransition(async () => {
      const result = await updateStoreSettingsAction({
        postalCode,
        street: form.street.trim(),
        number: form.number.trim(),
        complement: form.complement.trim() || null,
        district: form.district.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        shippingServiceIds: form.shippingServiceIds,
      });

      if (result.ok) {
        toast.success("Configurações da loja salvas.");
      } else {
        toast.error(result.error ?? "Erro ao salvar as configurações.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="bg-background space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">Endereço de origem</h2>
          <p className="text-muted-foreground text-sm">
            Usado como ponto de partida no cálculo de fretes e, futuramente, na emissão de
            etiquetas. O CEP é obrigatório.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <Label htmlFor="street">Logradouro *</Label>
            <Input
              id="street"
              value={form.street}
              onChange={(event) => update({ street: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number">Número *</Label>
            <Input
              id="number"
              value={form.number}
              onChange={(event) => update({ number: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              value={form.complement}
              onChange={(event) => update({ complement: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">Bairro *</Label>
            <Input
              id="district"
              value={form.district}
              onChange={(event) => update({ district: event.target.value })}
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
        </div>
      </section>

      <section className="bg-background space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">Serviços de frete</h2>
          <p className="text-muted-foreground text-sm">
            Marque os serviços do Melhor Envio que deseja oferecer no checkout.
          </p>
          {serviceSource === "fallback" ? (
            <p className="text-muted-foreground text-xs">
              Não foi possível carregar a lista atual do Melhor Envio — exibindo as opções
              padrão.
            </p>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {serviceOptions.map((service) => {
            const checked = form.shippingServiceIds.includes(service.id);
            return (
              <label
                key={service.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => toggleService(service.id, value === true)}
                />
                <span className="space-y-0.5">
                  <span className="block font-medium">{service.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {service.companyName ?? "Transportadora"}
                    {" · "}
                    ID {service.id}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
