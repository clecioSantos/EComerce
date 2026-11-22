-- Mantem personalizacoes de clientes existentes e habilita heranca para perfis novos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conditional_customer_profiles'
      AND column_name = 'useStoreLimits'
  ) THEN
    ALTER TABLE "conditional_customer_profiles"
      ADD COLUMN "useStoreLimits" BOOLEAN NOT NULL DEFAULT TRUE;
    -- Perfis existentes mantem seus limites previamente negociados.
    UPDATE "conditional_customer_profiles" SET "useStoreLimits" = FALSE;
  END IF;
END $$;

-- Produtos novos habilitados, salvo desativacao explicita.
ALTER TABLE "products" ALTER COLUMN "conditionalEligible" SET DEFAULT TRUE;
