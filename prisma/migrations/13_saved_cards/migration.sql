-- Cartões salvos do cliente (referência ao cartão no Mercado Pago).
-- O PAN e o CVV NUNCA são armazenados: apenas o `providerCardId` e metadados.

CREATE TABLE "saved_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mercadopago',
    "providerCustomerId" TEXT NOT NULL,
    "providerCardId" TEXT NOT NULL,
    "brand" TEXT,
    "lastFourDigits" TEXT NOT NULL,
    "firstSixDigits" TEXT,
    "expirationMonth" INTEGER,
    "expirationYear" INTEGER,
    "cardholderName" TEXT,
    "paymentMethodId" TEXT,
    "issuerId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_cards_provider_providerCardId_key"
    ON "saved_cards"("provider", "providerCardId");

CREATE INDEX "saved_cards_userId_idx" ON "saved_cards"("userId");

ALTER TABLE "saved_cards"
    ADD CONSTRAINT "saved_cards_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
