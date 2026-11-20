import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { customerSummary, listCases } from "@/modules/conditional/service";
import { CustomerCapacity } from "@/components/conditional/customer-capacity";
import { STATUS_LABELS, overdue } from "@/modules/conditional/rules";
import { formatDateTime } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Meus condicionais",
  robots: { index: false, follow: false },
};
export default async function MyConditionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/conta/condicionais");
  const [summary, result] = await Promise.all([
    customerSummary(user.id),
    listCases({ id: user.id, admin: false }, Number(params.page ?? 1)),
  ]);
  const rows = result.rows;
  return (
    <div className="mx-auto max-w-5xl space-y-7 px-5 py-10">
      <h1 className="font-serif text-4xl">Meus condicionais</h1>
      <CustomerCapacity summary={summary} />
      <div className="flex gap-5 text-sm">
        <Link href="/condicional/novo" className="underline">
          Solicitar peças para experimentar
        </Link>
        <Link href="/conta" className="underline">
          Minha conta
        </Link>
      </div>
      <section className="space-y-4">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/conta/condicionais/${row.id}`}
            className="block space-y-2 rounded border p-5"
          >
            <h2 className="text-lg font-semibold">{row.number}</h2>
            <p className="text-sm">
              {STATUS_LABELS[row.status]} · {formatDateTime(row.createdAt)}
            </p>
            {overdue(row) ? (
              <p className="text-destructive text-sm">
                Há pendências. Abra o condicional e consulte a loja.
              </p>
            ) : null}
          </Link>
        ))}
        {!rows.length ? (
          <p className="text-muted-foreground">Você ainda não possui condicionais.</p>
        ) : null}
      </section>
      <nav aria-label="Páginas dos condicionais" className="flex gap-5 text-sm">
        {result.page > 1 ? (
          <Link className="underline" href={`?page=${result.page - 1}`}>
            Anterior
          </Link>
        ) : null}
        <span>Página {result.page}</span>
        {result.hasMore ? (
          <Link className="underline" href={`?page=${result.page + 1}`}>
            Próxima
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
