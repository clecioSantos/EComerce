"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/modules/customers/auth.actions";

export function RegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<{
    name: string;
    email: string;
    password: string;
  }>();

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await registerAction(values);
      if (result.ok) {
        toast.success("Conta criada com sucesso!");
        router.push("/conta");
        router.refresh();
      } else {
        setError(result.error ?? "Não foi possível criar a conta.");
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" required {...register("name")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" required {...register("email")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          {...register("password")}
        />
        <p className="text-muted-foreground text-xs">Mínimo de 8 caracteres.</p>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
