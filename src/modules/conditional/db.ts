import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Client que pode ser o normal ou o de transação. */
export type ConditionalDb = PrismaClient | Prisma.TransactionClient;

export { prisma };
