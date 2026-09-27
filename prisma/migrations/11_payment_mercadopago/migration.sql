-- Contas OAuth de provedores de pagamento (Mercado Pago) e states de autorização.

CREATE TABLE "payment_provider_accounts" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "publicKey" TEXT,
    "tokenType" TEXT,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3),
    "refreshLockedUntil" TIMESTAMP(3),
    "liveMode" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_provider_accounts_provider_key"
    ON "payment_provider_accounts"("provider");

CREATE TABLE "payment_oauth_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_oauth_states_state_key"
    ON "payment_oauth_states"("state");

CREATE INDEX "payment_oauth_states_provider_state_idx"
    ON "payment_oauth_states"("provider", "state");

CREATE INDEX "payment_oauth_states_expiresAt_idx"
    ON "payment_oauth_states"("expiresAt");
