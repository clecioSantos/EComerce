import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ActionForm, Field, LimitFields } from "@/components/conditional/action-form";
import { STORE_ID } from "@/modules/conditional/rules";
export const dynamic = "force-dynamic";
export default async function ConditionalSettingsPage() {
  await requireAdmin();
  const [settings, products] = await Promise.all([
    prisma.conditionalSettings.findUnique({ where: { storeId: STORE_ID } }),
    prisma.product.findMany({
      where: { storeId: STORE_ID, status: "ACTIVE" },
      select: { id: true, name: true, conditionalEligible: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <h1 className="text-3xl font-semibold">Configurar condicional</h1>
      <Link href="/admin/condicionais" className="underline">
        Voltar aos condicionais
      </Link>
      <p className="text-sm leading-relaxed">
        Defina os limites gerais e as condições comerciais antes de habilitar. A aprovação
        de cada solicitação continua manual. Alterar condições cria uma nova versão;
        operações existentes conservam o acordo aceito.
      </p>
      <ActionForm
        operation="settings"
        label="Salvar políticas"
        key={settings?.updatedAt.toISOString()}
      >
        <label className="flex items-center gap-3">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={settings?.enabled ?? false}
          />
          Aceitar novas solicitações
        </label>
        <LimitFields
          data={
            settings
              ? {
                  maxOpenUnits: settings.maxOpenUnits,
                  maxCaseUnits: settings.maxCaseUnits,
                  maxOpenCases: settings.maxOpenCases,
                  maxOpenAmount: String(settings.maxOpenAmount),
                  maxCaseAmount: String(settings.maxCaseAmount),
                }
              : null
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["trialDays", "Dias para experimentar", 3],
            ["returnDays", "Dias para devolver", 5],
            ["paymentDays", "Dias para pagar o acerto", 3],
            ["reserveHours", "Horas para expedir após aprovação", 24],
            ["requestHours", "Horas de validade da solicitação", 48],
          ].map(([name, label, defaultValue]) => (
            <Field
              key={String(name)}
              name={String(name)}
              label={String(label)}
              type="number"
              min={1}
              step="1"
              value={Number(settings?.[name as "trialDays"] ?? defaultValue)}
              required
            />
          ))}
        </div>
        <label className="grid gap-2 text-sm">
          Condições de uso
          <textarea
            name="terms"
            className="bg-background min-h-48 rounded border p-3"
            maxLength={10000}
            defaultValue={settings?.terms ?? ""}
            required
          />
        </label>
        <label className="grid gap-2 text-sm">
          Política de frete e devolução
          <textarea
            name="freightPolicy"
            className="bg-background min-h-28 rounded border p-3"
            maxLength={2000}
            defaultValue={settings?.freightPolicy ?? ""}
            required
          />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            name="customerPaysShipping"
            type="checkbox"
            defaultChecked={settings?.customerPaysShipping ?? false}
          />
          Cobrar no acerto o frete de ida selecionado pela cliente
        </label>
        <Field
          name="returnFee"
          label="Taxa de retorno previamente acordada (R$; zero se assumida pela loja)"
          value={String(settings?.returnFee ?? 0)}
          type="number"
          min={0}
          step="0.01"
          required
        />
        <Field name="reason" label="Motivo da configuração/revisão" required />
      </ActionForm>
      <section className="bg-background space-y-4 rounded border p-5">
        <h2 className="text-xl font-semibold">Produtos elegíveis</h2>
        <p className="text-muted-foreground text-sm">
          Habilitar o produto não habilita clientes automaticamente.
        </p>
        {products.map((p) => (
          <ActionForm
            key={p.id + String(p.conditionalEligible)}
            operation="product"
            values={{ productId: p.id }}
            label="Atualizar produto"
            className="border-t pt-3"
          >
            <label className="flex items-center gap-3 text-sm">
              <input
                name="eligible"
                type="checkbox"
                defaultChecked={p.conditionalEligible}
              />
              {p.name}
            </label>
          </ActionForm>
        ))}
      </section>
    </div>
  );
}
