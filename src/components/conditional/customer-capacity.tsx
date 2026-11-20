import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { ELIGIBILITY_LABELS } from "@/modules/conditional/rules";
import type { customerSummary } from "@/modules/conditional/service";
export function CustomerCapacity({
  summary,
  admin = false,
}: {
  summary: Awaited<ReturnType<typeof customerSummary>>;
  admin?: boolean;
}) {
  const { profile, usage, limits, policy } = summary;
  return (
    <section className="bg-background space-y-3 rounded-lg border p-5">
      <h2 className="text-lg font-semibold">Habilitação para condicional</h2>
      <p>
        Situação:{" "}
        <strong>{ELIGIBILITY_LABELS[profile?.eligibility ?? "NOT_REVIEWED"]}</strong>
      </p>
      {profile?.eligibleUntil ? (
        <p className="text-sm">
          Válida até {profile.eligibleUntil.toLocaleDateString("pt-BR")}
        </p>
      ) : null}
      {!policy?.enabled ? (
        <p className="text-muted-foreground text-sm">
          A loja não está aceitando novas solicitações.
        </p>
      ) : null}
      {usage.blocked ? (
        <p role="alert" className="text-destructive text-sm">
          Há pendências que impedem novas aprovações. Consulte a loja.
        </p>
      ) : null}
      {limits ? (
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt>Total em aberto / limite</dt>
            <dd className="font-semibold">
              {formatCurrency(usage.amount)} / {formatCurrency(limits.maxOpenAmount)}
            </dd>
          </div>
          <div>
            <dt>Peças em aberto / limite</dt>
            <dd className="font-semibold">
              {usage.units} / {limits.maxOpenUnits}
            </dd>
          </div>
          <div>
            <dt>Saldo para nova aprovação</dt>
            <dd className="font-semibold">
              {formatCurrency(Math.max(0, limits.maxOpenAmount - usage.amount))} ·{" "}
              {Math.max(0, limits.maxOpenUnits - usage.units)} peças
            </dd>
          </div>
          <div>
            <dt>Máximo por solicitação</dt>
            <dd className="font-semibold">
              {formatCurrency(limits.maxCaseAmount)} · {limits.maxCaseUnits} peças
            </dd>
          </div>
          <div>
            <dt>Operações abertas / limite</dt>
            <dd>
              {usage.cases} / {limits.maxOpenCases}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground text-sm">
          A loja precisa avaliar o cadastro e definir seus limites.
        </p>
      )}
      {admin && profile?.notes ? (
        <p className="text-sm whitespace-pre-line">
          Observações internas: {profile.notes}
        </p>
      ) : null}
      <Link
        href={admin ? "/admin/condicionais" : "/conta/condicionais"}
        className="text-sm underline"
      >
        Acompanhar condicionais
      </Link>
    </section>
  );
}
