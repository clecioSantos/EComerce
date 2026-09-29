"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/dal";

import {
  deleteSavedCard,
  listSavedCards,
  saveCardForUser,
  setDefaultSavedCard,
  type SavedCardDTO,
} from "./cards.service";
import {
  friendlyMercadoPagoMessage,
  MercadoPagoError,
} from "./providers/mercadopago/errors";

export interface CardActionResult {
  ok: boolean;
  error?: string;
  card?: SavedCardDTO;
  cards?: SavedCardDTO[];
}

function friendly(error: unknown): string {
  if (error instanceof MercadoPagoError) return friendlyMercadoPagoMessage(error);
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export async function saveCardAction(input: {
  token: string;
  setDefault?: boolean;
}): Promise<CardActionResult> {
  try {
    const user = await requireUser();
    const card = await saveCardForUser({
      userId: user.id,
      user: { id: user.id, email: user.email, name: user.name },
      token: input.token,
      setDefault: input.setDefault,
    });
    const cards = await listSavedCards(user.id);
    revalidatePath("/conta/cartoes");
    revalidatePath("/checkout");
    return { ok: true, card, cards };
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
}

export async function deleteCardAction(cardId: string): Promise<CardActionResult> {
  try {
    const user = await requireUser();
    await deleteSavedCard(user.id, cardId);
    const cards = await listSavedCards(user.id);
    revalidatePath("/conta/cartoes");
    return { ok: true, cards };
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
}

export async function setDefaultCardAction(cardId: string): Promise<CardActionResult> {
  try {
    const user = await requireUser();
    await setDefaultSavedCard(user.id, cardId);
    const cards = await listSavedCards(user.id);
    revalidatePath("/conta/cartoes");
    return { ok: true, cards };
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
}
