import "server-only";

import { prisma } from "@/lib/db/prisma";

import type { AddressInput, UpdateProfileInput } from "./schemas";

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

export async function updateCustomerProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  return prisma.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone ?? null },
  });
}

export async function listCustomerAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function createCustomerAddress(
  userId: string,
  input: AddressInput,
) {
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

export async function deleteCustomerAddress(userId: string, addressId: string) {
  return prisma.address.deleteMany({ where: { id: addressId, userId } });
}
