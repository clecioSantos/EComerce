-- Branding is tenant-specific, while legacy storefront remains explicitly scoped.
ALTER TABLE "stores"
  ADD COLUMN "tagline" TEXT,
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#202b35',
  ADD COLUMN "accentColor" TEXT NOT NULL DEFAULT '#d7a66a';
