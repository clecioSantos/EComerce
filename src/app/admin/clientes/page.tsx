import { formatDate } from "@/lib/format";
import { listCustomers } from "@/modules/customers/customer.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clientes" };

export default async function AdminCustomersPage() {
  const customers = await listCustomers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground text-sm">
          {customers.length} cliente(s).
        </p>
      </div>

      <div className="bg-background overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Pedidos</th>
              <th className="px-4 py-3 font-medium">Cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-3">{customer.name ?? "-"}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {customer.email}
                </td>
                <td className="px-4 py-3">{customer._count.orders}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {formatDate(customer.createdAt)}
                </td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
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
