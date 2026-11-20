import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCase } from "@/modules/conditional/service";
import { CaseDetail } from "@/components/conditional/case-detail";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Acompanhar condicional",
  robots: { index: false, follow: false },
};
export default async function ConditionalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/conta/condicionais");
  const { id } = await params;
  const actor = { id: user.id, admin: false };
  const row = await getCase(actor, id).catch(() => null);
  if (!row) notFound();
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <CaseDetail row={row} actor={actor} />
    </div>
  );
}
