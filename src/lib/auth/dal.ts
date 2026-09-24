import "server-only";

import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * Data Access Layer — centraliza autenticação e autorização.
 * Use sempre estas funções perto da fonte de dados.
 */
export const getSession = cache(async () => {
  return auth();
});

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
    },
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
}
