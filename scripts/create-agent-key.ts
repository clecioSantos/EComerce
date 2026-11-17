import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("Uso: npx tsx scripts/create-agent-key.ts <store-slug>");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const store = await prisma.store.findUnique({ where: { slug } });
    if (!store?.isActive) throw new Error("Loja inexistente ou inativa.");
    const token = "ecom_agent_" + randomBytes(32).toString("hex");
    await prisma.agentApiCredential.create({
      data: { storeId: store.id, name: "Integração agente", keyHash: createHash("sha256").update(token).digest("hex") },
    });
    console.log("Chave criada. Guarde em segredo; não será exibida novamente.");
    console.log(token);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
