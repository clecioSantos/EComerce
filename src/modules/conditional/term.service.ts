import "server-only";

import { recordAudit } from "./audit.service";
import { prisma, type ConditionalDb } from "./db";

export async function listTerms(db: ConditionalDb = prisma) {
  return db.conditionalTerm.findMany({ orderBy: { version: "desc" } });
}

export async function getActiveTerm(db: ConditionalDb = prisma) {
  return db.conditionalTerm.findFirst({
    where: { active: true },
    orderBy: { version: "desc" },
  });
}

/** Publica uma nova versão do termo e desativa as anteriores. */
export async function publishTerm(
  params: { title: string; content: string },
  actorUserId: string | null,
) {
  const last = await prisma.conditionalTerm.findFirst({
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const term = await prisma.$transaction(async (tx) => {
    await tx.conditionalTerm.updateMany({
      where: { active: true },
      data: { active: false },
    });
    return tx.conditionalTerm.create({
      data: { version, title: params.title, content: params.content, active: true },
    });
  });

  await recordAudit({
    event: "TERM_PUBLISHED",
    entity: "ConditionalTerm",
    entityId: term.id,
    actorUserId,
    metadata: { version },
  });

  return term;
}

/** O cliente aceitou a versão vigente? */
export async function hasAcceptedActiveTerm(
  userId: string,
  db: ConditionalDb = prisma,
): Promise<boolean> {
  const term = await getActiveTerm(db);
  if (!term) return false;
  const acceptance = await db.conditionalTermAcceptance.findUnique({
    where: { termId_userId: { termId: term.id, userId } },
  });
  return Boolean(acceptance);
}

/** Registra o aceite da versão vigente (idempotente). */
export async function acceptActiveTerm(userId: string) {
  const term = await getActiveTerm();
  if (!term) throw new Error("Nenhum termo de Compra Condicional vigente.");

  const acceptance = await prisma.conditionalTermAcceptance.upsert({
    where: { termId_userId: { termId: term.id, userId } },
    create: { termId: term.id, userId },
    update: {},
  });

  await recordAudit({
    event: "TERM_ACCEPTED",
    entity: "ConditionalTermAcceptance",
    entityId: acceptance.id,
    actorUserId: userId,
    metadata: { termId: term.id, version: term.version, userId },
  });

  return term;
}
