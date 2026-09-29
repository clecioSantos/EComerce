import Link from "next/link";
import { redirect } from "next/navigation";

import { AddressBook } from "@/components/account/address-book";
import { CardList } from "@/components/account/card-list";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth/dal";
import { getEnv } from "@/lib/env";
import { listSavedCards } from "@/modules/payments/cards.service";
import {
  resolveMercadoPagoEnvironment,
  selectMercadoPagoPublicKey,
} from "@/modules/payments/providers/mercadopago/environment";
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
  const cards = await listSavedCards(user.id);

  const environment = resolveMercadoPagoEnvironment(getEnv().MERCADOPAGO_ENVIRONMENT);
  const mercadoPagoPublicKey = selectMercadoPagoPublicKey({
    environment,
    productionPublicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? null,
    sandboxPublicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_SANDBOX_PUBLIC_KEY ?? null,
  });

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

        <section className="rounded-lg border p-5 md:col-span-2">
          <CardList cards={cards} mercadoPagoPublicKey={mercadoPagoPublicKey} />
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
