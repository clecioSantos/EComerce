import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

// The existing public storefront is scoped to the legacy store until tenant routing is enabled.
export const PUBLIC_STOREFRONT_STORE_ID = "legacy-store";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal válida.");
export const appearanceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(180),
  logoUrl: z.union([z.literal(""), z.string().url().max(600).refine(v => {
    const url = new URL(v);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use uma URL HTTPS para o logotipo.")]),
  primaryColor: color,
  accentColor: color,
});
export type AppearanceInput = z.infer<typeof appearanceSchema>;

export const defaultAppearance: AppearanceInput = {
  name: "Sua Loja",
  tagline: "Escolhas que combinam com você.",
  logoUrl: "",
  primaryColor: "#202b35",
  accentColor: "#d7a66a",
};

export async function getStoreAppearance(): Promise<AppearanceInput> {
  const store = await prisma.store.findUnique({
    where: { id: PUBLIC_STOREFRONT_STORE_ID },
    select: { name: true, tagline: true, logoUrl: true, primaryColor: true, accentColor: true },
  });
  return store ? {
    name: store.name,
    tagline: store.tagline ?? defaultAppearance.tagline,
    logoUrl: store.logoUrl ?? "",
    primaryColor: store.primaryColor,
    accentColor: store.accentColor,
  } : defaultAppearance;
}

export async function updateStoreAppearance(value: unknown) {
  const data = appearanceSchema.parse(value);
  await prisma.store.update({ where: { id: PUBLIC_STOREFRONT_STORE_ID }, data });
  return data;
}
