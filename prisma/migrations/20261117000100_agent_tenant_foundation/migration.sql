-- Backfill the existing single-store data without changing its business logic.
-- This is a compatibility migration, not the complete tenant-isolation rollout.
CREATE TABLE "stores" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");
INSERT INTO "stores" ("id", "name", "slug", "updatedAt")
VALUES ('legacy-store', 'Loja principal', 'loja-principal', CURRENT_TIMESTAMP);

ALTER TABLE "products" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'legacy-store';
ALTER TABLE "carts" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'legacy-store';
ALTER TABLE "orders" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'legacy-store';
CREATE INDEX "products_storeId_idx" ON "products"("storeId");
CREATE INDEX "carts_storeId_idx" ON "carts"("storeId");
CREATE INDEX "orders_storeId_idx" ON "orders"("storeId");
ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "agent_api_credentials" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "agent_api_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_api_credentials_keyHash_key" ON "agent_api_credentials"("keyHash");
CREATE INDEX "agent_api_credentials_storeId_idx" ON "agent_api_credentials"("storeId");
ALTER TABLE "agent_api_credentials" ADD CONSTRAINT "agent_api_credentials_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agent_checkout_sessions" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_checkout_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_checkout_sessions_tokenHash_key" ON "agent_checkout_sessions"("tokenHash");
CREATE INDEX "agent_checkout_sessions_storeId_expiresAt_idx" ON "agent_checkout_sessions"("storeId","expiresAt");
ALTER TABLE "agent_checkout_sessions" ADD CONSTRAINT "agent_checkout_sessions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_checkout_sessions" ADD CONSTRAINT "agent_checkout_sessions_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
