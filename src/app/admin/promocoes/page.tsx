import {
  PromotionManager,
  type PromotionDTO,
} from "@/components/admin/promotion-manager";
import { prisma } from "@/lib/db/prisma";
import { listCategories } from "@/modules/categories/category.service";
import { listPromotions } from "@/modules/promotions/promotion.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Promoções" };

export default async function AdminPromotionsPage() {
  const [promotions, categories, products] = await Promise.all([
    listPromotions(),
    listCategories(),
    prisma.product.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  const items: PromotionDTO[] = promotions.map((promotion) => ({
    id: promotion.id,
    name: promotion.name,
    description: promotion.description,
    type: promotion.type,
    value: Number(promotion.value),
    scope: promotion.scope,
    categoryId: promotion.categoryId,
    productId: promotion.productId,
    minSubtotal: promotion.minSubtotal == null ? null : Number(promotion.minSubtotal),
    minQuantity: promotion.minQuantity,
    startsAt: promotion.startsAt ? promotion.startsAt.toISOString() : null,
    endsAt: promotion.endsAt ? promotion.endsAt.toISOString() : null,
    isActive: promotion.isActive,
    stackable: promotion.stackable,
    priority: promotion.priority,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Promoções</h1>
        <p className="text-muted-foreground text-sm">
          Descontos automáticos (não exigem cupom): percentual, valor fixo ou frete
          grátis.
        </p>
      </div>

      <PromotionManager promotions={items} categories={categories} products={products} />
    </div>
  );
}
