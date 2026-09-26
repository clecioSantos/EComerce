-- Dados logísticos genéricos por variante (peso já existia; dimensões em cm).
ALTER TABLE "product_variants"
  ADD COLUMN "width" DECIMAL(10,2),
  ADD COLUMN "height" DECIMAL(10,2),
  ADD COLUMN "length" DECIMAL(10,2);

-- Snapshot do frete selecionado no pedido. O preço efetivamente cobrado já é
-- persistido em shippingTotal; aqui guardamos o restante da opção escolhida.
ALTER TABLE "orders"
  ADD COLUMN "shippingServiceId" TEXT,
  ADD COLUMN "shippingCompany" TEXT,
  ADD COLUMN "shippingEstimatedDaysMin" INTEGER,
  ADD COLUMN "shippingEstimatedDaysMax" INTEGER,
  ADD COLUMN "shippingSnapshot" JSONB;

-- Configurações da loja (singleton): endereço de origem + serviços habilitados.
CREATE TABLE "store_settings" (
  "id" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "complement" TEXT,
  "district" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "shippingServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);
