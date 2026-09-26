"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth/dal";

import {
  createCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  updateCustomerAddress,
} from "./customer.service";
import { addressSchema, updateAddressSchema } from "./schemas";

export interface AddressActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return "Verifique os dados do endereço (incluindo o CEP).";
  }
  if (error instanceof Error) {
    if (error.message === "UNAUTHENTICATED") {
      return "Faça login para gerenciar endereços.";
    }
    return error.message;
  }
  return "Não foi possível concluir a operação.";
}

function revalidateAddresses() {
  revalidatePath("/conta");
  revalidatePath("/checkout");
}

export async function createAddressAction(input: unknown): Promise<AddressActionResult> {
  try {
    const user = await requireUser();
    const parsed = addressSchema.parse(input);
    const address = await createCustomerAddress(user.id, parsed);
    revalidateAddresses();
    return { ok: true, id: address.id };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateAddressAction(input: unknown): Promise<AddressActionResult> {
  try {
    const user = await requireUser();
    const parsed = updateAddressSchema.parse(input);
    const address = await updateCustomerAddress(user.id, parsed);
    if (!address) return { ok: false, error: "Endereço não encontrado." };
    revalidateAddresses();
    return { ok: true, id: address.id };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteAddressAction(
  addressId: string,
): Promise<AddressActionResult> {
  try {
    const user = await requireUser();
    const result = await deleteCustomerAddress(user.id, addressId);
    if (result.count === 0) {
      return { ok: false, error: "Endereço não encontrado." };
    }
    revalidateAddresses();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function setDefaultAddressAction(
  addressId: string,
): Promise<AddressActionResult> {
  try {
    const user = await requireUser();
    const address = await setDefaultCustomerAddress(user.id, addressId);
    if (!address) return { ok: false, error: "Endereço não encontrado." };
    revalidateAddresses();
    return { ok: true, id: address.id };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
