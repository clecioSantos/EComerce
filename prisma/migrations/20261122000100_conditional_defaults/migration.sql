-- Mantem personalizacoes ja existentes; novos perfis seguem os limites da loja.
ALTER TABLE "conditional_customer_profiles"
  ADD COLUMN IF NOT EXISTS "useStoreLimits" BOOLEAN NOT NULL DEFAULT TRUE;

-- Registros existentes tinham limites individuais gravados. Preserva esses limites.
-- Execute esta migracao apenas uma vez via Prisma migrate deploy.
UPDATE "conditional_customer_profiles"
SET "useStoreLimits" = FALSE
WHERE "eligibility" = 'ELIGIBLE';

-- Produtos novos participam do condicional, salvo desativacao explicita.
ALTER TABLE "products"
  ALTER COLUMN "conditionalEligible" SET DEFAULT TRUE;
