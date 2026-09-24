import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: getEnv().DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

function getPrismaClient(): ReturnType<typeof createPrismaClient> {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Client preguiçoso: `DATABASE_URL` só é exigida quando uma query é executada.
 * Isso permite `npm install` e `npm run build` sem variáveis de ambiente, sem
 * alterar o comportamento de runtime (que continua exigindo a variável ao
 * acessar o banco).
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type { PrismaClient };
