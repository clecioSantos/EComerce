-- The agent worker keeps its own database and global admin API.
-- Bind the commerce store to one agent-service record without sharing credentials.
ALTER TABLE "stores" ADD COLUMN "agentServiceId" TEXT;
CREATE UNIQUE INDEX "stores_agentServiceId_key" ON "stores"("agentServiceId");
