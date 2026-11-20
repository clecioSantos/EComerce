import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { getCase } from "@/modules/conditional/service";
import { CaseDetail } from "@/components/conditional/case-detail";
export const dynamic = "force-dynamic";
export default async function ConditionalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const actor = { id: user.id, admin: true };
  const row = await getCase(actor, id).catch(() => null);
  if (!row) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <CaseDetail row={row} actor={actor} />
    </div>
  );
}
