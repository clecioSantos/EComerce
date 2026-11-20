import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { listCases } from "@/modules/conditional/service";
import { STATUS_LABELS, STORE_ID, overdue } from "@/modules/conditional/rules";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ActionForm } from "@/components/conditional/action-form";
export const dynamic = "force-dynamic";
export default async function ConditionalAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAdmin();
  const [result, settings] = await Promise.all([
    listCases({ id: user.id, admin: true }, Number(params.page ?? 1), params.status),
    prisma.conditionalSettings.findUnique({ where: { storeId: STORE_ID } }),
  ]);
  const cases = result.rows;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Condicionais</h1>
      <div className="flex flex-wrap gap-5 text-sm">
        <Link href="/admin/condicionais/configuracoes" className="underline">
          Políticas e produtos
        </Link>
        <Link href="/admin/clientes" className="underline">
          Clientes e limites
        </Link>
      </div>
      <p className="text-sm">
        Novas solicitações:{" "}
        <strong>{settings?.enabled ? "habilitadas" : "desativadas"}</strong>.
        Acompanhamento, recebimento e acerto continuam disponíveis para operações abertas.
      </p>
      <ActionForm operation="maintain" label="Revisar prazos e gerar avisos" />
      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-2">
          Situação
          <select
            className="bg-background min-h-11 rounded border px-3"
            name="status"
            defaultValue={params.status ?? ""}
          >
            <option value="">Todas</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="bg-primary text-primary-foreground min-h-11 rounded px-5">
          Filtrar
        </button>
      </form>
      <div className="bg-background overflow-x-auto rounded border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Número", "Cliente", "Situação", "Mercadorias", "Criado em"].map((h) => (
                <th className="p-4" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((row) => (
              <tr className="border-t" key={row.id}>
                <td className="p-4">
                  <Link className="underline" href={`/admin/condicionais/${row.id}`}>
                    {row.number}
                  </Link>
                </td>
                <td className="p-4">{row.user.name ?? row.user.email}</td>
                <td className="p-4">
                  {STATUS_LABELS[row.status]}
                  {overdue(row) ? (
                    <strong className="text-destructive block">Com pendência</strong>
                  ) : null}
                </td>
                <td className="p-4">
                  {formatCurrency(
                    row.items.reduce((n, i) => n + Number(i.unitPrice) * i.quantity, 0),
                  )}
                </td>
                <td className="p-4">{formatDateTime(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cases.length ? (
          <p className="p-5 text-sm">Nenhum condicional solicitado.</p>
        ) : null}
      </div>
      <nav aria-label="Páginas dos condicionais" className="flex gap-5 text-sm">
        {result.page > 1 ? (
          <Link
            className="underline"
            href={`?page=${result.page - 1}&status=${encodeURIComponent(params.status ?? "")}`}
          >
            Anterior
          </Link>
        ) : null}
        <span>Página {result.page}</span>
        {result.hasMore ? (
          <Link
            className="underline"
            href={`?page=${result.page + 1}&status=${encodeURIComponent(params.status ?? "")}`}
          >
            Próxima
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
