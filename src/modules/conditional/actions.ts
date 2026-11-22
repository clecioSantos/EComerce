"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import * as conditional from "./service";
import { payConditional } from "./payment";
import { refundOrder } from "@/modules/payments/payment.service";
import { requestSchema } from "./rules";
const adminOperations = new Set([
  "settings",
  "profile",
  "product",
  "approve",
  "reject",
  "dispatch",
  "receive",
  "receiveReturn",
  "inspect",
  "review",
  "maintain",
  "adminQuote",
  "adminRequest",
  "adminContact",
  "refund",
]);
const inputSchema = z.object({
  operation: z.string(),
  values: z.record(z.string(), z.string()).default({}),
});
const text = (x: string | undefined, max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .parse(x ?? "");
const id = (x: string | undefined) => z.string().min(1).max(100).parse(x);
export async function conditionalAction(input: unknown) {
  try {
    const { operation, values: v } = inputSchema.parse(input);
    const user = adminOperations.has(operation)
      ? await requireAdmin()
      : await requireUser();
    const actor = {
      id: user.id,
      admin: adminOperations.has(operation),
      customerId:
        adminOperations.has(operation) && v.customerId ? id(v.customerId) : undefined,
    };
    const caseId = v.caseId;
    switch (operation) {
      case "contact":
      case "adminContact": {
        const targetId = operation === "adminContact" ? id(v.userId) : user.id;
        const data = z
          .object({
            name: z.string().trim().min(2).max(120),
            phone: z.string().trim().min(8).max(30),
          })
          .parse(v);
        await prisma.user.update({ where: { id: targetId }, data });
        break;
      }
      case "settings":
        await conditional.saveSettings(actor, {
          ...v,
          enabled: v.enabled === "on",
          customerPaysShipping: v.customerPaysShipping === "on",
        });
        break;
      case "profile": {
        const useStoreLimits = v.useStoreLimits === "on";
        const storePolicy = useStoreLimits
          ? await prisma.conditionalSettings.findUnique({ where: { storeId: "legacy-store" } })
          : null;
        await conditional.saveProfile(actor, {
          ...v,
          ...(useStoreLimits ? {
            maxOpenAmount: Number(storePolicy?.maxOpenAmount ?? 0),
            maxOpenUnits: storePolicy?.maxOpenUnits ?? 0,
            maxCaseAmount: Number(storePolicy?.maxCaseAmount ?? 0),
            maxCaseUnits: storePolicy?.maxCaseUnits ?? 0,
            maxOpenCases: storePolicy?.maxOpenCases ?? 0,
          } : {}),
          useStoreLimits,
          eligibleUntil: v.eligibleUntil ? `${v.eligibleUntil}T23:59:59-03:00` : null,
        });
        break;
      }
      case "product":
        await conditional.setProductEligibility(
          actor,
          id(v.productId),
          v.eligible === "on",
        );
        break;
      case "adminQuote":
      case "quote": {
        const items = Object.entries(v)
          .filter(([k, val]) => k.startsWith("qty:") && Number(val) > 0)
          .map(([k, val]) => ({ variantId: k.slice(4), quantity: Number(val) }));
        const data = requestSchema
          .pick({ items: true, addressId: true })
          .parse({ items, addressId: v.addressId });
        const { options } = await conditional.quoteConditional(actor, data);
        return { ok: true as const, options };
      }
      case "adminRequest":
      case "request": {
        const items = Object.entries(v)
          .filter(([k, val]) => k.startsWith("qty:") && Number(val) > 0)
          .map(([k, val]) => ({ variantId: k.slice(4), quantity: Number(val) }));
        const newId = await conditional.requestConditional(actor, {
          items,
          addressId: v.addressId,
          shippingOptionId: v.shippingOptionId,
          termsVersion: Number(v.termsVersion),
          accepted: v.accepted === "on",
          key: v.key,
        });
        refresh();
        return { ok: true as const, id: newId };
      }
      case "approve":
        await conditional.approveConditional(actor, id(caseId));
        break;
      case "cancel":
        await conditional.cancelConditional(actor, id(caseId), text(v.reason));
        break;
      case "reject":
        await conditional.cancelConditional(actor, id(caseId), text(v.reason), true);
        break;
      case "dispatch":
        await conditional.dispatchConditional(
          actor,
          id(caseId),
          text(v.tracking, 150),
          text(v.evidence),
        );
        break;
      case "receive":
        await conditional.receiveConditional(actor, id(caseId), text(v.evidence));
        break;
      case "choose":
        await conditional.chooseConditional(
          actor,
          id(caseId),
          Object.entries(v)
            .filter(([k]) => k.startsWith("keep:"))
            .map(([k, val]) => ({ itemId: k.slice(5), quantity: Number(val) })),
        );
        break;
      case "declareReturn":
        await conditional.declareReturn(
          actor,
          id(caseId),
          text(v.tracking, 150),
          text(v.evidence),
        );
        break;
      case "receiveReturn":
        await conditional.receiveReturn(
          actor,
          id(caseId),
          id(v.itemId),
          Number(v.quantity),
          text(v.evidence),
          z.string().uuid().parse(v.key),
          v.purchased === "on",
        );
        break;
      case "inspect":
        await conditional.inspectReturn(
          actor,
          id(caseId),
          id(v.returnId),
          text(v.outcome, 30),
          text(v.evidence),
        );
        break;
      case "review":
        await conditional.reviewCase(actor, id(caseId), {
          reason: text(v.reason),
          ...(v.totalDueAt
            ? { totalDueAt: new Date(`${v.totalDueAt}T23:59:59-03:00`) }
            : {}),
          ...(v.issueMode === "clear"
            ? { issue: null }
            : v.issue
              ? { issue: text(v.issue) }
              : {}),
          ...(v.choiceDueAt
            ? { choiceDueAt: new Date(`${v.choiceDueAt}T23:59:59-03:00`) }
            : {}),
          ...(v.returnDueAt
            ? { returnDueAt: new Date(`${v.returnDueAt}T23:59:59-03:00`) }
            : {}),
          ...(v.paymentDueAt
            ? { paymentDueAt: new Date(`${v.paymentDueAt}T23:59:59-03:00`) }
            : {}),
        });
        break;
      case "pay": {
        const payment = await payConditional(actor, id(caseId));
        refresh();
        return { ok: true as const, payment };
      }
      case "refund": {
        const row = await conditional.getCase(actor, id(caseId));
        const reason = z.string().trim().min(5).max(1000).parse(v.reason);
        if (!row.order) throw new Error("Não há pagamento vinculado.");
        await refundOrder(row.order.id, reason);
        await prisma.conditionalEvent.upsert({
          where: { key: `refund:${row.order.id}` },
          create: {
            caseId: row.id,
            key: `refund:${row.order.id}`,
            type: "REFUNDED",
            actorId: actor.id,
            message: "Acerto integral reembolsado após conferência.",
          },
          update: {},
        });
        break;
      }
      case "maintain":
        await conditional.maintainConditionalCases();
        break;
      default:
        throw new Error("Ação inválida.");
    }
    refresh();
    return { ok: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      logger.error({ event: "CONDITIONAL_ACTION_FAILED", code: error.code });
    return {
      ok: false as const,
      error:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Dados inválidos.")
          : error instanceof Prisma.PrismaClientKnownRequestError
            ? "Não foi possível salvar. Atualize a página e tente novamente."
            : error instanceof Error
              ? error.message
              : "Não foi possível concluir a operação.",
    };
  }
}
function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/conta", "layout");
  revalidatePath("/condicional");
  revalidatePath("/produtos");
}
