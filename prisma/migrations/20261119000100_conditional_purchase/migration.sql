-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'CONDITIONAL';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "conditionalEligible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "quantityOnConditional" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantityQuarantined" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "conditionalCaseId" TEXT;

-- CreateTable
CREATE TABLE "conditional_settings" (
    "storeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "maxOpenAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxOpenUnits" INTEGER NOT NULL DEFAULT 0,
    "maxCaseAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxCaseUnits" INTEGER NOT NULL DEFAULT 0,
    "maxOpenCases" INTEGER NOT NULL DEFAULT 0,
    "trialDays" INTEGER NOT NULL DEFAULT 3,
    "returnDays" INTEGER NOT NULL DEFAULT 5,
    "paymentDays" INTEGER NOT NULL DEFAULT 3,
    "reserveHours" INTEGER NOT NULL DEFAULT 24,
    "requestHours" INTEGER NOT NULL DEFAULT 48,
    "terms" TEXT NOT NULL DEFAULT '',
    "termsVersion" INTEGER NOT NULL DEFAULT 1,
    "customerPaysShipping" BOOLEAN NOT NULL DEFAULT false,
    "returnFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "freightPolicy" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_settings_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "conditional_customer_profiles" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eligibility" TEXT NOT NULL DEFAULT 'NOT_REVIEWED',
    "maxOpenAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxOpenUnits" INTEGER NOT NULL DEFAULT 0,
    "maxCaseAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxCaseUnits" INTEGER NOT NULL DEFAULT 0,
    "maxOpenCases" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "eligibleUntil" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_cases" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "address" JSONB NOT NULL,
    "terms" TEXT NOT NULL,
    "termsVersion" INTEGER NOT NULL,
    "freightPolicy" TEXT NOT NULL,
    "policy" JSONB NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "requestDueAt" TIMESTAMP(3) NOT NULL,
    "reserveDueAt" TIMESTAMP(3),
    "choiceDueAt" TIMESTAMP(3),
    "returnDueAt" TIMESTAMP(3),
    "paymentDueAt" TIMESTAMP(3),
    "shippingFee" DECIMAL(12,2) NOT NULL,
    "returnFee" DECIMAL(12,2) NOT NULL,
    "shippingSnapshot" JSONB NOT NULL,
    "issue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_items" (
    "purchasedReceivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "purchasedApprovedQuantity" INTEGER NOT NULL DEFAULT 0,
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "imageUrl" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "keepQuantity" INTEGER,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "approvedReturnQuantity" INTEGER NOT NULL DEFAULT 0,
    "writtenOffQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "conditional_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conditional_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_profile_events" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conditional_profile_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_shipments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "tracking" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conditional_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_returns" (
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT NOT NULL,
    "inspectedBy" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conditional_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conditional_customer_profiles_storeId_eligibility_idx" ON "conditional_customer_profiles"("storeId", "eligibility");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_customer_profiles_storeId_userId_key" ON "conditional_customer_profiles"("storeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_cases_number_key" ON "conditional_cases"("number");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_cases_requestKey_key" ON "conditional_cases"("requestKey");

-- CreateIndex
CREATE INDEX "conditional_cases_storeId_userId_status_idx" ON "conditional_cases"("storeId", "userId", "status");

-- CreateIndex
CREATE INDEX "conditional_cases_storeId_status_choiceDueAt_idx" ON "conditional_cases"("storeId", "status", "choiceDueAt");

-- CreateIndex
CREATE INDEX "conditional_items_variantId_idx" ON "conditional_items"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_items_caseId_variantId_key" ON "conditional_items"("caseId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_events_key_key" ON "conditional_events"("key");

-- CreateIndex
CREATE INDEX "conditional_events_caseId_createdAt_idx" ON "conditional_events"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "conditional_profile_events_storeId_userId_createdAt_idx" ON "conditional_profile_events"("storeId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "conditional_shipments_caseId_direction_idx" ON "conditional_shipments"("caseId", "direction");

-- CreateIndex
CREATE INDEX "conditional_returns_caseId_outcome_idx" ON "conditional_returns"("caseId", "outcome");

-- CreateIndex
CREATE INDEX "conditional_returns_itemId_idx" ON "conditional_returns"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_conditionalCaseId_key" ON "orders"("conditionalCaseId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_conditionalCaseId_fkey" FOREIGN KEY ("conditionalCaseId") REFERENCES "conditional_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_settings" ADD CONSTRAINT "conditional_settings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_customer_profiles" ADD CONSTRAINT "conditional_customer_profiles_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_customer_profiles" ADD CONSTRAINT "conditional_customer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_cases" ADD CONSTRAINT "conditional_cases_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_cases" ADD CONSTRAINT "conditional_cases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_items" ADD CONSTRAINT "conditional_items_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "conditional_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_items" ADD CONSTRAINT "conditional_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_events" ADD CONSTRAINT "conditional_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "conditional_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_shipments" ADD CONSTRAINT "conditional_shipments_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "conditional_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_returns" ADD CONSTRAINT "conditional_returns_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "conditional_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_returns" ADD CONSTRAINT "conditional_returns_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "conditional_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity of custody balances; existing inventory values remain unchanged.
ALTER TABLE inventory ADD CONSTRAINT inventory_conditional_nonnegative CHECK ("quantityOnConditional" >= 0 AND "quantityQuarantined" >= 0);
ALTER TABLE conditional_customer_profiles ADD CONSTRAINT conditional_profile_limits_nonnegative CHECK ("maxOpenAmount" >= 0 AND "maxOpenUnits" >= 0 AND "maxCaseAmount" >= 0 AND "maxCaseUnits" >= 0 AND "maxOpenCases" >= 0);
ALTER TABLE conditional_customer_profiles ADD CONSTRAINT conditional_profile_eligibility CHECK (eligibility IN ('NOT_REVIEWED','ELIGIBLE','SUSPENDED','INELIGIBLE'));
ALTER TABLE conditional_cases ADD CONSTRAINT conditional_case_status CHECK (status IN ('REQUESTED','APPROVED','DISPATCHED','RECEIVED','DECIDED','CLOSED','CANCELED','REJECTED'));
ALTER TABLE conditional_cases ADD CONSTRAINT conditional_case_costs CHECK ("shippingFee" >= 0 AND "returnFee" >= 0);
ALTER TABLE conditional_items ADD CONSTRAINT conditional_item_quantities CHECK (quantity > 0 AND "unitPrice" >= 0 AND ("keepQuantity" IS NULL OR "keepQuantity" BETWEEN 0 AND quantity) AND "soldQuantity" >= 0 AND "soldQuantity" <= COALESCE("keepQuantity",0) AND "receivedQuantity" >= 0 AND "receivedQuantity" <= quantity-COALESCE("keepQuantity",0) AND "approvedReturnQuantity" >= 0 AND "writtenOffQuantity" >= 0 AND "approvedReturnQuantity"+"writtenOffQuantity" <= "receivedQuantity" AND "purchasedReceivedQuantity" >= 0 AND "purchasedReceivedQuantity" <= "soldQuantity" AND "purchasedApprovedQuantity" >= 0 AND "purchasedApprovedQuantity" <= "purchasedReceivedQuantity");
ALTER TABLE conditional_returns ADD CONSTRAINT conditional_return_quantity CHECK (quantity > 0);
ALTER TABLE conditional_returns ADD CONSTRAINT conditional_return_outcome CHECK (outcome IN ('PENDING','APPROVED','ISSUE','WRITE_OFF'));

-- Server-only Prisma access: no exposure of customer limits or custody through the Data API.
ALTER TABLE conditional_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_profile_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_returns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON conditional_settings,conditional_customer_profiles,conditional_cases,conditional_items,conditional_events,conditional_profile_events,conditional_shipments,conditional_returns FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON conditional_settings,conditional_customer_profiles,conditional_cases,conditional_items,conditional_events,conditional_profile_events,conditional_shipments,conditional_returns FROM authenticated;
 END IF;
END $$;
