import Link from "next/link";
import { redirect } from "next/navigation";

import { AddressBook } from "@/components/account/address-book";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth/dal";
import { listCustomerAddresses } from "@/modules/customers/customer.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/conta");

  const addresses = await listCustomerAddresses(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Minha conta</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="space-y-2 rounded-lg border p-5">
          <h2 className="text-sm font-semibold">Dados pessoais</h2>
          <p className="text-sm">{user.name}</p>
          <p className="text-muted-foreground text-sm">{user.email}</p>
          {user.phone ? <p className="text-sm">{user.phone}</p> : null}
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            render={<Link href="/conta/pedidos" />}
          >
            Ver meus pedidos
          </Button>
        </section>

        <section className="rounded-lg border p-5">
          <AddressBook addresses={addresses} />
        </section>
      </div>

      {user.role === "ADMIN" ? (
        <>
          <Separator className="my-6" />
          <Button variant="secondary" render={<Link href="/admin" />}>
            Ir para o painel administrativo
          </Button>
        </>
      ) : null}
    </div>
  );
}
