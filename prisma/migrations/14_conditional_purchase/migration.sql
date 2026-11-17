-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('NORMAL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ReturnShippingPolicy" AS ENUM ('FREE', 'MIN_PURCHASE', 'PAID');

-- CreateEnum
CREATE TYPE "ConditionalCustomerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ConditionalPurchaseStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'DECISION_PENDING', 'PROCESSING_DECISION', 'COMPLETED', 'RETURNING', 'INSPECTING', 'ISSUE_FOUND', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConditionalItemDecision" AS ENUM ('KEEP', 'RETURN');

-- CreateEnum
CREATE TYPE "ConditionalItemStatus" AS ENUM ('PENDING_DECISION', 'KEEP', 'RETURN', 'RETURNING', 'RETURNED', 'INSPECTED');

-- CreateEnum
CREATE TYPE "ConditionalInspectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DAMAGED', 'MISSING', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "ConditionalStockHoldStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTING', 'COMPLETED', 'ISSUE');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "type" "OrderType" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "store_settings" ALTER COLUMN "id" SET DEFAULT 'default';

-- CreateTable
CREATE TABLE "conditional_purchase_policies" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "maxItemsPerOrder" INTEGER NOT NULL DEFAULT 5,
    "maxOrderAmount" DECIMAL(12,2) NOT NULL DEFAULT 1500,
    "maxOpenConditionalOrders" INTEGER NOT NULL DEFAULT 1,
    "maxCustomerExposure" DECIMAL(12,2) NOT NULL DEFAULT 1500,
    "decisionDeadlineDays" INTEGER NOT NULL DEFAULT 7,
    "returnShippingPolicy" "ReturnShippingPolicy" NOT NULL DEFAULT 'FREE',
    "returnShippingMinPurchase" DECIMAL(12,2),
    "returnShippingAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_purchase_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_customers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ConditionalCustomerStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "reason" TEXT,
    "overrideEnabled" BOOLEAN,
    "overrideMaxItems" INTEGER,
    "overrideMaxOrderAmount" DECIMAL(12,2),
    "overrideMaxOpenOrders" INTEGER,
    "overrideMaxExposure" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_terms" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_term_acceptances" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conditional_term_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_purchases" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ConditionalPurchaseStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "termId" TEXT,
    "termVersion" INTEGER,
    "termAcceptedAt" TIMESTAMP(3),
    "policySnapshot" JSONB,
    "exposureAmount" DECIMAL(12,2) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "decisionDeadline" TIMESTAMP(3),
    "decisionFinalizedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_purchase_items" (
    "id" TEXT NOT NULL,
    "conditionalPurchaseId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "status" "ConditionalItemStatus" NOT NULL DEFAULT 'PENDING_DECISION',
    "customerDecision" "ConditionalItemDecision",
    "decidedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "inspectionStatus" "ConditionalInspectionStatus" DEFAULT 'PENDING',
    "inspectedAt" TIMESTAMP(3),
    "inspectedBy" TEXT,
    "inspectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_stock_holds" (
    "id" TEXT NOT NULL,
    "conditionalPurchaseId" TEXT NOT NULL,
    "conditionalItemId" TEXT,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ConditionalStockHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "conditional_stock_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "conditionalPurchaseId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "receivedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "inspectedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "conditionalItemId" TEXT NOT NULL,
    "inspectionStatus" "ConditionalInspectionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conditional_customers_userId_key" ON "conditional_customers"("userId");

-- CreateIndex
CREATE INDEX "conditional_customers_status_idx" ON "conditional_customers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_terms_version_key" ON "conditional_terms"("version");

-- CreateIndex
CREATE INDEX "conditional_term_acceptances_userId_idx" ON "conditional_term_acceptances"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_term_acceptances_termId_userId_key" ON "conditional_term_acceptances"("termId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_purchases_orderId_key" ON "conditional_purchases"("orderId");

-- CreateIndex
CREATE INDEX "conditional_purchases_status_idx" ON "conditional_purchases"("status");

-- CreateIndex
CREATE INDEX "conditional_purchases_decisionDeadline_idx" ON "conditional_purchases"("decisionDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_purchase_items_orderItemId_key" ON "conditional_purchase_items"("orderItemId");

-- CreateIndex
CREATE INDEX "conditional_purchase_items_conditionalPurchaseId_idx" ON "conditional_purchase_items"("conditionalPurchaseId");

-- CreateIndex
CREATE INDEX "conditional_purchase_items_status_idx" ON "conditional_purchase_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_stock_holds_conditionalItemId_key" ON "conditional_stock_holds"("conditionalItemId");

-- CreateIndex
CREATE INDEX "conditional_stock_holds_conditionalPurchaseId_idx" ON "conditional_stock_holds"("conditionalPurchaseId");

-- CreateIndex
CREATE INDEX "conditional_stock_holds_variantId_idx" ON "conditional_stock_holds"("variantId");

-- CreateIndex
CREATE INDEX "conditional_stock_holds_status_idx" ON "conditional_stock_holds"("status");

-- CreateIndex
CREATE INDEX "returns_conditionalPurchaseId_idx" ON "returns"("conditionalPurchaseId");

-- CreateIndex
CREATE INDEX "returns_status_idx" ON "returns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "return_items_returnId_conditionalItemId_key" ON "return_items"("returnId", "conditionalItemId");

-- CreateIndex
CREATE INDEX "audit_events_entity_entityId_idx" ON "audit_events"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_event_idx" ON "audit_events"("event");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "orders_type_idx" ON "orders"("type");

-- AddForeignKey
ALTER TABLE "conditional_customers" ADD CONSTRAINT "conditional_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_term_acceptances" ADD CONSTRAINT "conditional_term_acceptances_termId_fkey" FOREIGN KEY ("termId") REFERENCES "conditional_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_term_acceptances" ADD CONSTRAINT "conditional_term_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_purchases" ADD CONSTRAINT "conditional_purchases_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_purchases" ADD CONSTRAINT "conditional_purchases_termId_fkey" FOREIGN KEY ("termId") REFERENCES "conditional_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_purchase_items" ADD CONSTRAINT "conditional_purchase_items_conditionalPurchaseId_fkey" FOREIGN KEY ("conditionalPurchaseId") REFERENCES "conditional_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_purchase_items" ADD CONSTRAINT "conditional_purchase_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_stock_holds" ADD CONSTRAINT "conditional_stock_holds_conditionalPurchaseId_fkey" FOREIGN KEY ("conditionalPurchaseId") REFERENCES "conditional_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_stock_holds" ADD CONSTRAINT "conditional_stock_holds_conditionalItemId_fkey" FOREIGN KEY ("conditionalItemId") REFERENCES "conditional_purchase_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_stock_holds" ADD CONSTRAINT "conditional_stock_holds_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_conditionalPurchaseId_fkey" FOREIGN KEY ("conditionalPurchaseId") REFERENCES "conditional_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_conditionalItemId_fkey" FOREIGN KEY ("conditionalItemId") REFERENCES "conditional_purchase_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
