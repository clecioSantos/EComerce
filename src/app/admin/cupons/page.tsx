import { CouponForm } from "@/components/admin/coupon-form";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { listCoupons } from "@/modules/promotions/promotion.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cupons" };

export default async function AdminCouponsPage() {
  const coupons = await listCoupons();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cupons</h1>
        <p className="text-muted-foreground text-sm">
          Descontos percentuais, valor fixo ou frete grátis.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="bg-background overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Usos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className="px-4 py-3 font-medium">{coupon.code}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{coupon.type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {coupon.type === "PERCENTAGE"
                      ? `${Number(coupon.value)}%`
                      : coupon.type === "FREE_SHIPPING"
                        ? "Frete grátis"
                        : formatCurrency(Number(coupon.value))}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {coupon.usedCount}
                    {coupon.maxUses ? ` / ${coupon.maxUses}` : ""}
                  </td>
                </tr>
              ))}
              {coupons.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-muted-foreground px-4 py-8 text-center"
                  >
                    Nenhum cupom cadastrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <CouponForm />
      </div>
    </div>
  );
}
