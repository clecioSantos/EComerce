import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

/** Eventos de auditoria da Compra Condicional. */
export type ConditionalAuditEvent =
  | "CUSTOMER_APPROVED"
  | "CUSTOMER_REJECTED"
  | "CUSTOMER_SUSPENDED"
  | "CUSTOMER_REACTIVATED"
  | "TERM_ACCEPTED"
  | "TERM_PUBLISHED"
  | "POLICY_UPDATED"
  | "OVERRIDE_UPDATED"
  | "CONDITIONAL_ORDER_CREATED"
  | "CONDITIONAL_ORDER_APPROVED"
  | "CONDITIONAL_ORDER_SHIPPED"
  | "CONDITIONAL_ORDER_DELIVERED"
  | "CUSTOMER_DECISION_STARTED"
  | "ITEM_MARKED_KEEP"
  | "ITEM_MARKED_RETURN"
  | "DECISION_FINALIZED"
  | "RETURN_CREATED"
  | "RETURN_RECEIVED"
  | "RETURN_INSPECTED"
  | "PAYMENT_FINALIZED"
  | "REFUND_CREATED";

export interface AuditInput {
  event: ConditionalAuditEvent;
  entity: string;
  entityId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Registra um evento de auditoria e um log estruturado (sem dados sensíveis). */
export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      event: input.event,
      entity: input.entity,
      entityId: input.entityId ?? null,
      actorUserId: input.actorUserId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  logger.info({
    event: input.event,
    entity: input.entity,
    entityId: input.entityId ?? undefined,
    actorUserId: input.actorUserId ?? undefined,
    ...input.metadata,
  });
}
