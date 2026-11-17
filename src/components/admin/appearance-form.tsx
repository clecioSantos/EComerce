"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAppearanceAction } from "@/modules/settings/appearance.actions";

export type AppearanceValues = {
  name: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
};

export function AppearanceForm({ initial }: { initial: AppearanceValues }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  function change(key: keyof AppearanceValues, value: string) {
    setValues(current => ({ ...current, [key]: value }));
  }
  function save() {
    startTransition(async () => {
      const response = await updateAppearanceAction(values);
      if (response.ok) toast.success("Identidade visual salva.");
      else toast.error(response.error ?? "Falha ao salvar.");
    });
  }
  return (
    <section className="space-y-5 rounded-md border bg-background p-5 md:p-7">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Identidade visual</h2>
        <p className="mt-1 text-sm text-muted-foreground">Altere a marca sem modificar o código. As mudanças aparecem na vitrine.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="brand-name">Nome da loja</Label><Input id="brand-name" maxLength={80} value={values.name} onChange={e => change("name", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="brand-tagline">Frase de destaque</Label><Input id="brand-tagline" maxLength={180} value={values.tagline} onChange={e => change("tagline", e.target.value)} /></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="brand-logo">URL do logotipo (HTTPS, opcional)</Label><Input id="brand-logo" type="url" placeholder="https://exemplo.com/logo.svg" value={values.logoUrl} onChange={e => change("logoUrl", e.target.value)} /><p className="text-xs text-muted-foreground">Sem imagem, o nome da loja é usado como identidade visual.</p></div>
        <div className="space-y-2"><Label htmlFor="brand-primary">Cor principal</Label><div className="flex gap-3"><Input id="brand-primary" type="color" className="h-10 w-16 cursor-pointer p-1" value={values.primaryColor} onChange={e => change("primaryColor", e.target.value)} /><Input aria-label="Código da cor principal" value={values.primaryColor} onChange={e => change("primaryColor", e.target.value)} /></div></div>
        <div className="space-y-2"><Label htmlFor="brand-accent">Cor de destaque</Label><div className="flex gap-3"><Input id="brand-accent" type="color" className="h-10 w-16 cursor-pointer p-1" value={values.accentColor} onChange={e => change("accentColor", e.target.value)} /><Input aria-label="Código da cor de destaque" value={values.accentColor} onChange={e => change("accentColor", e.target.value)} /></div></div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-5">
        <div className="flex items-center gap-3 text-sm"><span className="size-8 rounded-sm border" style={{ backgroundColor: values.primaryColor }} /><span className="size-8 rounded-sm border" style={{ backgroundColor: values.accentColor }} /><span className="text-muted-foreground">Prévia de cores</span></div>
        <Button disabled={pending} onClick={save}>{pending ? "Salvando..." : "Salvar identidade"}</Button>
      </div>
    </section>
  );
}
