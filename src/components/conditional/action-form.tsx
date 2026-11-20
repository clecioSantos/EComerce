"use client";
import { type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conditionalAction } from "@/modules/conditional/actions";
import { Button } from "@/components/ui/button";

export function ActionForm({
  operation,
  values = {},
  children,
  label = "Salvar",
  className = "",
  confirm,
}: {
  operation: string;
  values?: Record<string, string>;
  children?: ReactNode;
  label?: string;
  className?: string;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  return (
    <form
      className={`space-y-4 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fields = Object.fromEntries(
          new FormData(e.currentTarget).entries(),
        ) as Record<string, string>;
        setError("");
        setSuccess(false);
        start(async () => {
          const result = await conditionalAction({
            operation,
            values: { ...values, ...fields },
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setSuccess(true);
          router.refresh();
        });
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Processando…" : label}
        </Button>
        {success ? (
          <p role="status" className="text-sm">
            Salvo.
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
export function Field({
  name,
  label,
  value = "",
  type = "text",
  required = false,
  min,
  step,
}: {
  name: string;
  label: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  min?: number;
  step?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span>{label}</span>
      <input
        className="bg-background min-h-11 w-full rounded-md border px-3"
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        min={min}
        step={step}
      />
    </label>
  );
}
export function Note({
  name = "reason",
  label = "Motivo",
  required = true,
}: {
  name?: string;
  label?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span>{label}</span>
      <textarea
        name={name}
        className="bg-background min-h-20 w-full rounded-md border p-3"
        minLength={required ? 5 : undefined}
        maxLength={2000}
        required={required}
      />
    </label>
  );
}
export function LimitFields({
  data,
}: {
  data?: {
    maxOpenAmount: unknown;
    maxOpenUnits: number;
    maxCaseAmount: unknown;
    maxCaseUnits: number;
    maxOpenCases: number;
  } | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        ["maxOpenAmount", "Valor máximo total em aberto (R$)"],
        ["maxOpenUnits", "Peças máximas em aberto"],
        ["maxCaseAmount", "Valor máximo por solicitação (R$)"],
        ["maxCaseUnits", "Peças máximas por solicitação"],
        ["maxOpenCases", "Condicionais simultâneos"],
      ].map(([name, label]) => (
        <Field
          key={name}
          name={name}
          label={label}
          type="number"
          value={String(data?.[name as keyof typeof data] ?? 0)}
          min={0}
          step={name.includes("Amount") ? "0.01" : "1"}
          required
        />
      ))}
    </div>
  );
}
