"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { appearanceSchema, updateStoreAppearance } from "@/modules/settings/appearance";

export async function updateAppearanceAction(value: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Acesso restrito a administradores." };
  }
  const parsed = appearanceSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Verifique os campos de identidade visual." };
  try {
    await updateStoreAppearance(parsed.data);
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracoes");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar a identidade da loja." };
  }
}
