import { z } from "zod";
import { Decimal } from "decimal.js";

export const STORE_ID = "legacy-store"; // Storefront/admin currently have no tenant routing.
export const ELIGIBILITY_LABELS: Record<string, string> = {
  NOT_REVIEWED: "Não avaliada",
  ELIGIBLE: "Elegível",
  SUSPENDED: "Suspensa",
  INELIGIBLE: "Não elegível",
};
export const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Solicitado",
  APPROVED: "Aprovado / em separação",
  DISPATCHED: "Enviado / retirado",
  RECEIVED: "Em experimentação",
  DECIDED: "Em acerto e devolução",
  CLOSED: "Encerrado",
  CANCELED: "Cancelado",
  REJECTED: "Recusado",
};
export const ACTIVE = ["APPROVED", "DISPATCHED", "RECEIVED", "DECIDED"];
export const limitsShape = {
  maxOpenAmount: z.coerce.number().min(0).max(9999999),
  maxOpenUnits: z.coerce.number().int().min(0).max(10000),
  maxCaseAmount: z.coerce.number().min(0).max(9999999),
  maxCaseUnits: z.coerce.number().int().min(0).max(1000),
  maxOpenCases: z.coerce.number().int().min(0).max(100),
};
export const settingsSchema = z
  .object({
    ...limitsShape,
    enabled: z.boolean(),
    totalDays: z.coerce.number().int().min(1).max(60),
    reserveHours: z.coerce.number().int().min(1).max(168),
    requestHours: z.coerce.number().int().min(1).max(168),
    terms: z.string().trim().max(10000),
    freightPolicy: z.string().trim().max(2000),
    customerPaysShipping: z.boolean(),
    returnFee: z.coerce.number().min(0).max(99999),
    reason: z.string().trim().min(5).max(1000),
  })
  .superRefine((x, ctx) => {
    if (
      x.enabled &&
      (Object.keys(limitsShape).some((k) => Number(x[k as keyof typeof x]) <= 0) ||
        x.terms.length < 20 ||
        x.freightPolicy.length < 10)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Defina limites positivos, condições e política de frete antes de habilitar.",
      });
  });
export const profileSchema = z
  .object({
    ...limitsShape,
    userId: z.string().min(1),
    useStoreLimits: z.boolean().default(true),
    eligibility: z.enum(["NOT_REVIEWED", "ELIGIBLE", "SUSPENDED", "INELIGIBLE"]),
    eligibleUntil: z.string().nullable(),
    notes: z.string().max(2000),
    reason: z.string().trim().min(5).max(1000),
  })
  .superRefine((x, ctx) => {
    if (
      x.eligibility === "ELIGIBLE" && !x.useStoreLimits &&
      Object.keys(limitsShape).some((k) => Number(x[k as keyof typeof x]) <= 0)
    )
      ctx.addIssue({
        code: "custom",
        message: "Defina todos os limites positivos para habilitar a cliente.",
      });
    if (
      x.eligibility === "ELIGIBLE" &&
      x.eligibleUntil &&
      (!Number.isFinite(Date.parse(x.eligibleUntil)) ||
        Date.parse(x.eligibleUntil) <= Date.now())
    )
      ctx.addIssue({ code: "custom", message: "A validade deve ser uma data futura." });
  });
export const requestSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(30),
  addressId: z.string().min(1),
  shippingOptionId: z.string().min(1),
  termsVersion: z.number().int().positive(),
  accepted: z.literal(true, {
    error: "Aceite as condições antes de solicitar o condicional.",
  }),
  key: z.string().uuid(),
});
export const selectionSchema = z
  .array(
    z.object({
      itemId: z.string().min(1),
      quantity: z.coerce.number().int().min(0).max(100),
    }),
  )
  .min(1)
  .max(30);
export type Limits = {
  maxOpenAmount: unknown;
  maxOpenUnits: number;
  maxCaseAmount: unknown;
  maxCaseUnits: number;
  maxOpenCases: number;
};
export type Usage = { amount: number; units: number; cases: number; blocked: boolean };
export function effectiveLimits(store: Limits, profile: Limits & { useStoreLimits?: boolean }) {
  if (profile.useStoreLimits) return {
    maxOpenAmount: Number(store.maxOpenAmount),
    maxOpenUnits: store.maxOpenUnits,
    maxCaseAmount: Number(store.maxCaseAmount),
    maxCaseUnits: store.maxCaseUnits,
    maxOpenCases: store.maxOpenCases,
  };
  return {
    maxOpenAmount: Math.min(Number(store.maxOpenAmount), Number(profile.maxOpenAmount)),
    maxOpenUnits: Math.min(store.maxOpenUnits, profile.maxOpenUnits),
    maxCaseAmount: Math.min(Number(store.maxCaseAmount), Number(profile.maxCaseAmount)),
    maxCaseUnits: Math.min(store.maxCaseUnits, profile.maxCaseUnits),
    maxOpenCases: Math.min(store.maxOpenCases, profile.maxOpenCases),
  };
}
export function assertCapacity(
  limits: ReturnType<typeof effectiveLimits>,
  usage: Usage,
  amount: number,
  units: number,
) {
  if (usage.blocked)
    throw new Error("Há pendências de prazo ou ocorrência. Procure a loja.");
  if (
    amount > limits.maxCaseAmount ||
    units > limits.maxCaseUnits ||
    new Decimal(usage.amount).plus(amount).gt(limits.maxOpenAmount) ||
    usage.units + units > limits.maxOpenUnits ||
    usage.cases + 1 > limits.maxOpenCases
  )
    throw new Error("A solicitação ultrapassa os limites disponíveis da cliente.");
}
export function unresolved(item: {
  quantity: number;
  soldQuantity: number;
  approvedReturnQuantity: number;
  writtenOffQuantity: number;
}) {
  return (
    item.quantity -
    item.soldQuantity -
    item.approvedReturnQuantity -
    item.writtenOffQuantity
  );
}
export function moneySum(lines: { unitPrice: unknown; quantity: number }[]) {
  return Number(
    lines
      .reduce(
        (n, line) => n.plus(new Decimal(String(line.unitPrice)).times(line.quantity)),
        new Decimal(0),
      )
      .toDecimalPlaces(2),
  );
}
export function afterHours(hours: number, now = new Date()) {
  return new Date(now.getTime() + hours * 3600000);
}
export function overdue(
  row: {
    status: string;
    issue: string | null;
    choiceDueAt: Date | null;
    returnDueAt: Date | null;
    paymentDueAt: Date | null;
    items: {
      quantity: number;
      keepQuantity: number | null;
      soldQuantity: number;
      approvedReturnQuantity: number;
      writtenOffQuantity: number;
    }[];
    order?: { paymentStatus: string } | null;
    returns?: { outcome: string }[];
  },
  now = new Date(),
) {
  if (row.issue || row.returns?.some((receipt) => receipt.outcome === "ISSUE"))
    return true;
  if (row.status === "RECEIVED" && row.choiceDueAt && row.choiceDueAt < now) return true;
  if (row.status === "DECIDED") {
    if (
      row.returnDueAt &&
      row.returnDueAt < now &&
      row.items.some(
        (i) =>
          i.quantity -
            (i.keepQuantity ?? 0) -
            i.approvedReturnQuantity -
            i.writtenOffQuantity >
          0,
      )
    )
      return true;
    if (
      row.paymentDueAt &&
      row.paymentDueAt < now &&
      row.order &&
      !["PAID", "REFUNDED"].includes(row.order.paymentStatus)
    )
      return true;
  }
  return false;
}
