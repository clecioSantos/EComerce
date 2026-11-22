-- Habilita condicional em todos os produtos existentes de todas as lojas.
-- Idempotente: pode executar novamente sem alterar outros dados.
BEGIN;
UPDATE "products"
SET "conditionalEligible" = TRUE,
    "updatedAt" = NOW()
WHERE "conditionalEligible" IS DISTINCT FROM TRUE;
COMMIT;
