"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { OrderStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/dal";
import {
  createAttribute,
  createProductType,
} from "@/modules/catalog/product-type.service";
import {
  createCategory,
  createCategorySchema,
} from "@/modules/categories/category.service";
import { applyInventoryMovement } from "@/modules/inventory/inventory.service";
import { updateOrderStatus } from "@/modules/orders/order.service";
import { refundOrder } from "@/modules/payments/payment.service";
import {
  createAttributeSchema,
  createProductSchema,
  createProductTypeSchema,
  updateProductSchema,
  variantLogisticsSchema,
  type CreateProductInput,
  type CreateProductTypeInput,
} from "@/modules/products/schemas";
import {
  createProduct,
  deleteProduct,
  updateProduct,
  updateProductStatus,
  updateVariantLogistics,
} from "@/modules/products/product.service";
import {
  createCoupon,
  createPromotion,
  deletePromotion,
  updatePromotion,
} from "@/modules/promotions/promotion.service";
import { createCouponSchema, createPromotionSchema } from "@/modules/promotions/schemas";
import { storeSettingsSchema } from "@/modules/shipping/schemas";
import { upsertStoreSettings } from "@/modules/settings/store-settings.service";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function guard(): Promise<string | null> {
  try {
    await requireAdmin();
    return null;
  } catch {
    return "Acesso restrito a administradores.";
  }
}

export async function createProductAction(
  input: CreateProductInput,
): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const parsed = createProductSchema.parse(input);
    const product = await createProduct(parsed);
    revalidatePath("/admin/produtos");
    revalidatePath("/produtos");
    return { ok: true, id: product.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao criar produto.",
    };
  }
}

export async function toggleProductStatusAction(
  id: string,
  status: "DRAFT" | "ACTIVE" | "ARCHIVED",
): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    await updateProductStatus(id, status);
    revalidatePath("/admin/produtos");
    revalidatePath("/produtos");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao atualizar produto." };
  }
}

export async function updateProductAction(input: unknown): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const parsed = updateProductSchema.parse(input);
    await updateProduct(parsed);
    revalidatePath("/admin/produtos");
    revalidatePath("/produtos");
    return { ok: true, id: parsed.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar produto.",
    };
  }
}

export async function deleteProductAction(id: string): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    await deleteProduct(id);
    revalidatePath("/admin/produtos");
    revalidatePath("/produtos");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao excluir produto.",
    };
  }
}

export async function createCategoryAction(input: unknown): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const parsed = createCategorySchema.parse(input);
    const category = await createCategory(parsed);
    revalidatePath("/admin/categorias");
    return { ok: true, id: category.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao criar categoria.",
    };
  }
}

export async function createProductTypeAction(
  input: CreateProductTypeInput,
): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const parsed = createProductTypeSchema.parse(input);
    const productType = await createProductType(parsed);
    revalidatePath("/admin/tipos");
    return { ok: true, id: productType.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao criar tipo de produto.",
    };
  }
}

export async function createAttributeAction(input: unknown): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const parsed = createAttributeSchema.parse(input);
    const attribute = await createAttribute(parsed);
    revalidatePath("/admin/atributos");
    return { ok: true, id: attribute.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao criar atributo.",
    };
  }
}

export async function createCouponAction(input: unknown): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const parsed = createCouponSchema.parse(input);
    const coupon = await createCoupon(parsed);
    revalidatePath("/admin/cupons");
    return { ok: true, id: coupon.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao criar cupom.",
    };
  }
}

function revalidatePromotions() {
  revalidatePath("/admin/promocoes");
  revalidatePath("/admin/cupons");
  revalidatePath("/produtos");
  revalidatePath("/carrinho");
  revalidatePath("/checkout");
}

export async function createPromotionAction(input: unknown): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const parsed = createPromotionSchema.parse(input);
    const promotion = await createPromotion(parsed);
    revalidatePromotions();
    return { ok: true, id: promotion.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao criar promoção.",
    };
  }
}

export async function updatePromotionAction(input: unknown): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const { id, ...data } = (input ?? {}) as Record<string, unknown>;
    const promotionId = z.string().min(1).parse(id);
    const parsed = createPromotionSchema.parse(data);
    await updatePromotion(promotionId, parsed);
    revalidatePromotions();
    return { ok: true, id: promotionId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar promoção.",
    };
  }
}

export async function togglePromotionActiveAction(
  id: string,
  isActive: boolean,
): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    await updatePromotion(id, { isActive });
    revalidatePromotions();
    return { ok: true, id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar promoção.",
    };
  }
}

export async function deletePromotionAction(id: string): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    await deletePromotion(id);
    revalidatePromotions();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao excluir promoção.",
    };
  }
}

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    if (status === "REFUNDED") {
      await refundOrder(orderId, "Reembolso administrativo");
    } else {
      await updateOrderStatus(orderId, status);
    }
    revalidatePath("/admin/pedidos");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar pedido.",
    };
  }
}

export async function adjustInventoryAction(input: {
  variantId: string;
  quantity: number;
  reason?: string;
}): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    await applyInventoryMovement({
      variantId: input.variantId,
      type: "ADJUSTMENT",
      quantity: input.quantity,
      reason: input.reason ?? "Ajuste manual (admin)",
    });
    revalidatePath("/admin/estoque");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao ajustar estoque.",
    };
  }
}

export async function updateVariantLogisticsAction(
  input: unknown,
): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const parsed = variantLogisticsSchema.parse(input);
    await updateVariantLogistics(parsed);
    revalidatePath("/admin/estoque");
    revalidatePath("/admin/produtos");
    revalidatePath("/checkout");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao salvar os dados de envio.",
    };
  }
}

export async function updateStoreSettingsAction(
  input: unknown,
): Promise<AdminActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  try {
    const parsed = storeSettingsSchema.parse(input);
    await upsertStoreSettings(parsed);
    revalidatePath("/admin/configuracoes");
    revalidatePath("/checkout");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro ao salvar as configurações da loja.",
    };
  }
}
