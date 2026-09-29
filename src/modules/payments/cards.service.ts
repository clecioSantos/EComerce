import "server-only";

import type { SavedCard } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";

import { getValidMercadoPagoAccessToken } from "./oauth/account.service";
import { MercadoPagoClient } from "./providers/mercadopago/client";
import { MercadoPagoError } from "./providers/mercadopago/errors";
import { splitName } from "./providers/mercadopago/mapper";

const PROVIDER = "mercadopago";

/** DTO seguro: nunca expõe PAN nem CVV. `providerCardId` é a referência do MP. */
export interface SavedCardDTO {
  id: string;
  providerCardId: string;
  brand: string | null;
  lastFourDigits: string;
  expirationMonth: number | null;
  expirationYear: number | null;
  cardholderName: string | null;
  paymentMethodId: string | null;
  issuerId: string | null;
  isDefault: boolean;
}

function mapRow(card: SavedCard): SavedCardDTO {
  return {
    id: card.id,
    providerCardId: card.providerCardId,
    brand: card.brand,
    lastFourDigits: card.lastFourDigits,
    expirationMonth: card.expirationMonth,
    expirationYear: card.expirationYear,
    cardholderName: card.cardholderName,
    paymentMethodId: card.paymentMethodId,
    issuerId: card.issuerId,
    isDefault: card.isDefault,
  };
}

async function createClient(): Promise<MercadoPagoClient> {
  const env = getEnv();
  const accessToken = await getValidMercadoPagoAccessToken();
  return new MercadoPagoClient({
    accessToken,
    apiUrl: env.MERCADOPAGO_API_URL,
    timeoutMs: env.MERCADOPAGO_TIMEOUT_MS,
  });
}

export async function listSavedCards(userId: string): Promise<SavedCardDTO[]> {
  const cards = await prisma.savedCard.findMany({
    where: { userId, provider: PROVIDER },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return cards.map(mapRow);
}

async function getOrCreateCustomerId(user: {
  id: string;
  email: string;
  name?: string | null;
}): Promise<string> {
  const existing = await prisma.savedCard.findFirst({
    where: { userId: user.id, provider: PROVIDER },
    select: { providerCustomerId: true },
  });
  if (existing) return existing.providerCustomerId;

  const client = await createClient();
  const search = await client.searchCustomers(user.email);
  const found = search.results?.[0];
  if (found?.id) return String(found.id);

  const { firstName, lastName } = splitName(user.name ?? "");
  const created = await client.createCustomer({
    email: user.email,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
  });
  if (!created?.id) {
    throw new MercadoPagoError({
      kind: "api",
      message: "Mercado Pago não retornou o cliente criado.",
    });
  }
  return String(created.id);
}

/** Salva o cartão no Mercado Pago (o token vem tokenizado do browser). */
export async function saveCardForUser(params: {
  userId: string;
  user: { id: string; email: string; name?: string | null };
  token: string;
  setDefault?: boolean;
}): Promise<SavedCardDTO> {
  const customerId = await getOrCreateCustomerId(params.user);
  const client = await createClient();
  const card = await client.saveCard(customerId, params.token);

  const existingCount = await prisma.savedCard.count({
    where: { userId: params.userId, provider: PROVIDER },
  });
  const isDefault = params.setDefault === true || existingCount === 0;
  if (isDefault) {
    await prisma.savedCard.updateMany({
      where: { userId: params.userId, provider: PROVIDER },
      data: { isDefault: false },
    });
  }

  const data = {
    userId: params.userId,
    provider: PROVIDER,
    providerCustomerId: customerId,
    providerCardId: String(card.id),
    brand: card.payment_method?.name ?? null,
    lastFourDigits: card.last_four_digits ?? "",
    firstSixDigits: card.first_six_digits ?? null,
    expirationMonth: card.expiration_month ?? null,
    expirationYear: card.expiration_year ?? null,
    cardholderName: card.cardholder?.name ?? null,
    paymentMethodId: card.payment_method?.id ?? null,
    issuerId: card.issuer?.id != null ? String(card.issuer.id) : null,
    isDefault,
  };

  const row = await prisma.savedCard.upsert({
    where: {
      provider_providerCardId: {
        provider: PROVIDER,
        providerCardId: data.providerCardId,
      },
    },
    create: data,
    update: {
      brand: data.brand,
      lastFourDigits: data.lastFourDigits,
      expirationMonth: data.expirationMonth,
      expirationYear: data.expirationYear,
      cardholderName: data.cardholderName,
      paymentMethodId: data.paymentMethodId,
      issuerId: data.issuerId,
      isDefault,
    },
  });

  return mapRow(row);
}

export async function deleteSavedCard(userId: string, cardId: string): Promise<void> {
  const card = await prisma.savedCard.findFirst({
    where: { id: cardId, userId, provider: PROVIDER },
  });
  if (!card) throw new Error("Cartão não encontrado.");

  try {
    const client = await createClient();
    await client.deleteCard(card.providerCustomerId, card.providerCardId);
  } catch {
    // Se o MP falhar, ainda removemos localmente para não travar o usuário.
  }

  await prisma.savedCard.delete({ where: { id: card.id } });

  if (card.isDefault) {
    const next = await prisma.savedCard.findFirst({
      where: { userId, provider: PROVIDER },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await prisma.savedCard.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
}

export async function setDefaultSavedCard(userId: string, cardId: string): Promise<void> {
  const card = await prisma.savedCard.findFirst({
    where: { id: cardId, userId, provider: PROVIDER },
  });
  if (!card) throw new Error("Cartão não encontrado.");

  await prisma.$transaction([
    prisma.savedCard.updateMany({
      where: { userId, provider: PROVIDER },
      data: { isDefault: false },
    }),
    prisma.savedCard.update({ where: { id: card.id }, data: { isDefault: true } }),
  ]);
}
