import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export class AgentAuthError extends Error {}

export async function authenticateAgent(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new AgentAuthError("Token ausente.");
  const token = auth.slice(7).trim();
  if (!/^ecom_agent_[a-f0-9]{64}$/.test(token)) {
    throw new AgentAuthError("Token inválido.");
  }
  const keyHash = createHash("sha256").update(token).digest("hex");
  const credential = await prisma.agentApiCredential.findUnique({
    where: { keyHash },
    include: { store: true },
  });
  if (!credential?.isActive || credential.revokedAt || !credential.store.isActive) {
    throw new AgentAuthError("Credencial inativa ou inválida.");
  }
  return { storeId: credential.storeId, credentialId: credential.id };
}

export function agentError(error: unknown) {
  if (error instanceof AgentAuthError) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  console.error("agent-api failure", error);
  return Response.json({ error: "Não foi possível processar a solicitação." }, { status: 500 });
}
