import "server-only";

import { prisma } from "@/lib/db/prisma";

import type { AddressInput, UpdateAddressInput, UpdateProfileInput } from "./schemas";
import type { CustomerAddressDTO } from "./types";

export async function getCustomerById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function getCustomerByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function listCustomers() {
  return prisma.user.findMany({
    where: { role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function countCustomers() {
  return prisma.user.count({ where: { role: "CUSTOMER" } });
}

export async function updateCustomerProfile(userId: string, input: UpdateProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone ?? null },
  });
}

export function toAddressDTO(address: {
  id: string;
  label: string | null;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}): CustomerAddressDTO {
  return {
    id: address.id,
    label: address.label,
    recipient: address.recipient,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
    isDefault: address.isDefault,
  };
}

export async function listCustomerAddresses(
  userId: string,
): Promise<CustomerAddressDTO[]> {
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return addresses.map(toAddressDTO);
}

export async function createCustomerAddress(userId: string, input: AddressInput) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: {
        userId,
        label: input.label ?? null,
        recipient: input.recipient,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country,
        phone: input.phone ?? null,
        isDefault: input.isDefault,
      },
    });
  });
}

/** Atualiza um endereço do próprio usuário. Retorna null se não existir. */
export async function updateCustomerAddress(userId: string, input: UpdateAddressInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id: input.id, userId },
      select: { id: true },
    });
    if (!existing) return null;

    if (input.isDefault) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return tx.address.update({
      where: { id: input.id },
      data: {
        label: input.label ?? null,
        recipient: input.recipient,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country,
        phone: input.phone ?? null,
        isDefault: input.isDefault,
      },
    });
  });
}

/** Define um endereço como padrão. Retorna null se não pertencer ao usuário. */
export async function setDefaultCustomerAddress(userId: string, addressId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });
    if (!existing) return null;

    await tx.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
    return tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
  });
}

export async function deleteCustomerAddress(userId: string, addressId: string) {
  return prisma.address.deleteMany({ where: { id: addressId, userId } });
}
