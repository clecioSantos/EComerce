import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { STORE_ID } from "@/modules/conditional/rules";
import { customerSummary } from "@/modules/conditional/service";
import { CustomerCapacity } from "@/components/conditional/customer-capacity";
import { RequestForm } from "@/components/conditional/request-form";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Solicitar condicional",
  robots: { index: false, follow: false },
};
export default async function NewConditionalPage({
  searchParams,
}: {
  searchParams: Promise<{ variante?: string; cliente?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/condicional/novo");
  const params = await searchParams;
  let userId = user.id;
  if (params.cliente) {
    await requireAdmin();
    const customer = await prisma.user.findFirst({
      where: { id: params.cliente, role: "CUSTOMER" },
    });
    if (!customer) redirect("/admin/clientes");
    userId = customer.id;
  }
  const summary = await customerSummary(userId);
  const policy = summary.policy;
  const canRequest =
    policy?.enabled &&
    summary.profile?.eligibility === "ELIGIBLE" &&
    (!summary.profile.eligibleUntil || summary.profile.eligibleUntil > new Date()) &&
    !summary.usage.blocked;
  const [addresses, variants] = canRequest
    ? await Promise.all([
        prisma.address.findMany({ where: { userId }, orderBy: { isDefault: "desc" } }),
        prisma.productVariant.findMany({
          where: {
            isActive: true,
            product: {
              storeId: STORE_ID,
              status: "ACTIVE",
              conditionalEligible: true,
              currency: "BRL",
            },
          },
          include: {
            product: true,
            inventory: true,
            attributes: { include: { attributeValue: true } },
          },
          orderBy: { sku: "asc" },
        }),
      ])
    : [[], []];
  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-10">
      <h1 className="font-serif text-4xl">Solicitar condicional</h1>
      <CustomerCapacity summary={summary} admin={!!params.cliente} />
      {params.cliente ? (
        <p>
          Solicitação administrativa para {params.cliente}. A cliente precisa ter aceitado
          as condições; registre a solicitação somente com autorização dela.
        </p>
      ) : null}
      {canRequest && policy ? (
        <>
          {!addresses.length ? (
            <p>
              Cadastre nome, telefone e endereço em{" "}
              <Link className="underline" href="/conta">
                Minha conta
              </Link>{" "}
              antes de solicitar.
            </p>
          ) : !variants.length ? (
            <p>Nenhuma peça está habilitada no momento.</p>
          ) : (
            <RequestForm
              selected={params.variante}
              customerId={params.cliente}
              terms={policy.terms}
              termsVersion={policy.termsVersion}
              freightPolicy={policy.freightPolicy}
              returnFee={Number(policy.returnFee)}
              customerPaysShipping={policy.customerPaysShipping}
              addresses={addresses.map((a) => ({
                id: a.id,
                label: `${a.recipient} · ${a.line1} · ${a.city}/${a.state}`,
              }))}
              variants={variants.map((v) => ({
                id: v.id,
                label: `${v.product.name} — ${v.attributes.map((a) => a.attributeValue.value).join(" / ") || v.sku}`,
                price: Number(v.price ?? v.product.basePrice),
                available: v.inventory
                  ? v.inventory.quantityOnHand -
                    v.inventory.quantityReserved -
                    v.inventory.quantityQuarantined
                  : 0,
              }))}
            />
          )}
        </>
      ) : (
        <p className="text-sm">
          Novas solicitações estão indisponíveis para este cadastro. Consulte a loja para
          avaliação e definição de limites.
        </p>
      )}
    </div>
  );
}
