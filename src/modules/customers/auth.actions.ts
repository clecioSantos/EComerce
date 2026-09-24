"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";

import { signIn, signOut } from "@/auth";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import {
  mergeGuestCartIntoUserCart,
  readCartToken,
} from "@/modules/cart/cart.service";

import { loginSchema, registerCustomerSchema } from "./schemas";

export interface AuthActionResult {
  ok: boolean;
  error?: string;
}

async function mergeGuestCart(email: string) {
  const token = await readCartToken();
  if (!token) return;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  if (!user) return;
  await mergeGuestCartIntoUserCart(user.id, token);
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Informe e-mail e senha válidos." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "E-mail ou senha inválidos." };
    }
    throw error;
  }

  await mergeGuestCart(parsed.data.email);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function registerAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const parsed = registerCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os dados informados." };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Já existe uma conta com este e-mail." };
  }

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: hashPassword(parsed.data.password),
      phone: parsed.data.phone ?? null,
    },
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Conta criada, mas o login falhou." };
    }
    throw error;
  }

  await mergeGuestCart(email);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logoutAction(): Promise<AuthActionResult> {
  await signOut({ redirect: false });
  revalidatePath("/", "layout");
  return { ok: true };
}
