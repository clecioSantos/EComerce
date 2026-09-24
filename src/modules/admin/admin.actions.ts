"use server";

import { revalidatePath } from "next/cache";

import type { OrderStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/dal";
import { createAttribute, createProductType } from "@/modules/catalog/product-type.service";
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
  type CreateProductInput,
  type CreateProductTypeInput,
} from "@/modules/products/schemas";
import { createProduct, updateProductStatus } from "@/modules/products/product.service";
import {
  createCoupon,
} from "@/modules/promotions/promotion.service";
import { createCouponSchema } from "@/modules/promotions/schemas";

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

export async function createCategoryAction(
  input: unknown,
): Promise<AdminActionResult> {
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
      error:
        error instanceof Error ? error.message : "Erro ao criar tipo de produto.",
    };
  }
}

export async function createAttributeAction(
  input: unknown,
): Promise<AdminActionResult> {
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

export async function createCouponAction(
  input: unknown,
): Promise<AdminActionResult> {
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
