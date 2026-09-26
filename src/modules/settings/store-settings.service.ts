import "server-only";

import type { StoreSettings } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { storeSettingsSchema, type StoreSettingsInput } from "@/modules/shipping/schemas";

/** Identificador do registro singleton de configurações da loja. */
export const STORE_SETTINGS_ID = "default";

export async function getStoreSettings(): Promise<StoreSettings | null> {
  return prisma.storeSettings.findUnique({ where: { id: STORE_SETTINGS_ID } });
}

export async function upsertStoreSettings(
  input: StoreSettingsInput,
): Promise<StoreSettings> {
  const data = storeSettingsSchema.parse(input);
  return prisma.storeSettings.upsert({
    where: { id: STORE_SETTINGS_ID },
    create: { id: STORE_SETTINGS_ID, ...data },
    update: data,
  });
}
