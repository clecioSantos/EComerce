import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/format";
import { ELIGIBILITY_LABELS } from "@/modules/conditional/rules";
import { listCustomers } from "@/modules/customers/customer.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clientes" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; eligibility?: string }>;
}) {
  const params = await searchParams;
  const customers = await listCustomers({
    query: params.q,
    eligibility: params.eligibility,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground text-sm">{customers.length} cliente(s).</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Use Editar para atualizar o cadastro, a elegibilidade e os limites do cliente.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-4 text-sm" method="get">
        <label className="grid gap-2">
          Buscar cliente
          <input
            className="bg-background min-h-11 rounded border px-3"
            name="q"
            defaultValue={params.q}
            placeholder="Nome ou e-mail"
          />
        </label>
        <label className="grid gap-2">
          Elegibilidade
          <select
            className="bg-background min-h-11 rounded border px-3"
            name="eligibility"
            defaultValue={params.eligibility ?? ""}
          >
            <option value="">Todas</option>
            {Object.entries(ELIGIBILITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="bg-primary text-primary-foreground min-h-11 rounded px-5"
          type="submit"
        >
          Filtrar
        </button>
      </form>
      <div className="bg-background overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Ações</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Pedidos</th>
              <th className="px-4 py-3 font-medium">Cadastro</th>
              <th className="px-4 py-3 font-medium">Condicional</th>
              <th className="px-4 py-3 font-medium">Limites individuais</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-3">{customer.name ?? "Sem nome"}</td>
                <td className="px-4 py-3">
                  <Button
                    variant="outline"
                    className="min-h-11 px-4"
                    aria-label={`Editar cliente ${customer.name ?? customer.email}`}
                    render={<Link href={`/admin/clientes/${customer.id}`} />}
                  >
                    <Pencil aria-hidden="true" />
                    Editar
                  </Button>
                </td>
                <td className="text-muted-foreground px-4 py-3">{customer.email}</td>
                <td className="px-4 py-3">{customer._count.orders}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {formatDate(customer.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {
                    ELIGIBILITY_LABELS[
                      customer.conditionalProfiles[0]?.eligibility ?? "NOT_REVIEWED"
                    ]
                  }
                </td>
                <td className="px-4 py-3">
                  {customer.conditionalProfiles[0]
                    ? `${formatCurrency(Number(customer.conditionalProfiles[0].maxOpenAmount))} · ${customer.conditionalProfiles[0].maxOpenUnits} peças`
                    : "Não definidos"}
                </td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">
                  Nenhum cliente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
