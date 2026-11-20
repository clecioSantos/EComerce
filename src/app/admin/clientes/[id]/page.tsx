import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { customerSummary } from "@/modules/conditional/service";
import { STORE_ID, ELIGIBILITY_LABELS } from "@/modules/conditional/rules";
import { ActionForm, Field, LimitFields } from "@/components/conditional/action-form";
import { CustomerCapacity } from "@/components/conditional/customer-capacity";
import { formatDateTime } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { addresses: true },
  });
  if (!user || user.role !== "CUSTOMER") notFound();
  const [summary, history] = await Promise.all([
    customerSummary(id),
    prisma.conditionalProfileEvent.findMany({
      where: { storeId: STORE_ID, userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const p = summary.profile;
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Editar cliente</h1>
        <Button
          variant="outline"
          className="min-h-11 px-4"
          render={<Link href="/admin/clientes" />}
        >
          <ArrowLeft aria-hidden="true" />
          Voltar aos clientes
        </Button>
      </div>
      <section className="bg-background space-y-3 rounded border p-5">
        <h2 className="text-xl font-semibold">Identificação e contato</h2>
        <ActionForm
          operation="adminContact"
          values={{ userId: id }}
          label="Atualizar dados cadastrais"
        >
          <Field name="name" label="Nome completo" value={user.name ?? ""} required />
          <Field name="phone" label="Telefone" value={user.phone ?? ""} required />
        </ActionForm>
        <p>{user.email}</p>
        <p>{user.phone ?? "Telefone não informado"}</p>
        {user.addresses.map((a) => (
          <p className="text-sm" key={a.id}>
            {a.recipient} · {a.line1} · {a.city}/{a.state} · {a.postalCode}
          </p>
        ))}
      </section>
      <CustomerCapacity summary={summary} admin />
      <Button
        className="min-h-11 px-4"
        render={<Link href={`/condicional/novo?cliente=${id}`} />}
      >
        <Plus aria-hidden="true" />
        Criar solicitação para esta cliente
      </Button>
      <section className="bg-background space-y-4 rounded border p-5">
        <h2 className="text-xl font-semibold">Elegibilidade e limites individuais</h2>
        <p className="text-muted-foreground text-sm">
          Os limites efetivos respeitam também os tetos da loja. Valores ausentes ou zero
          não são ilimitados.
        </p>
        <ActionForm
          operation="profile"
          values={{ userId: id }}
          key={p?.updatedAt.toISOString()}
          label="Salvar avaliação"
        >
          <label className="grid gap-2 text-sm">
            Situação
            <select
              name="eligibility"
              className="bg-background min-h-11 rounded border p-2"
              defaultValue={p?.eligibility ?? "NOT_REVIEWED"}
            >
              {Object.entries(ELIGIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <LimitFields
            data={
              p
                ? {
                    ...p,
                    maxOpenAmount: String(p.maxOpenAmount),
                    maxCaseAmount: String(p.maxCaseAmount),
                  }
                : null
            }
          />
          <Field
            name="eligibleUntil"
            label="Validade da autorização (opcional)"
            type="date"
            value={
              p?.eligibleUntil?.toLocaleDateString("en-CA", {
                timeZone: "America/Sao_Paulo",
              }) ?? ""
            }
          />
          <label className="grid gap-2 text-sm">
            Observações internas
            <textarea
              name="notes"
              className="bg-background min-h-24 rounded border p-3"
              maxLength={2000}
              defaultValue={p?.notes ?? ""}
            />
          </label>
          <Field name="reason" label="Motivo da avaliação/alteração" required />
        </ActionForm>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Histórico de avaliações</h2>
        {history.map((h) => (
          <div className="bg-background rounded border p-4 text-sm" key={h.id}>
            <p>
              {formatDateTime(h.createdAt)} · {h.reason}
            </p>
            <p className="text-muted-foreground">Responsável: {h.actorId}</p>
            <details>
              <summary>Valores anteriores e posteriores</summary>
              <pre className="overflow-auto p-3 text-xs">
                {JSON.stringify({ antes: h.before, depois: h.after }, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </section>
    </div>
  );
}
