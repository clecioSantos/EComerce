-- Variant signature determinística (ids de valores de atributo ordenados).
-- Backfill dos registros existentes antes de aplicar NOT NULL + UNIQUE.

ALTER TABLE "product_variants" ADD COLUMN "signature" TEXT;

UPDATE "product_variants" pv
SET "signature" = COALESCE(sub.sig, '')
FROM (
  SELECT pva."variantId",
         string_agg(
           pva."attributeValueId",
           '|' ORDER BY pva."attributeValueId" COLLATE "C"
         ) AS sig
  FROM "product_variant_attributes" pva
  GROUP BY pva."variantId"
) sub
WHERE pv."id" = sub."variantId";

UPDATE "product_variants" SET "signature" = '' WHERE "signature" IS NULL;

ALTER TABLE "product_variants" ALTER COLUMN "signature" SET NOT NULL;

CREATE UNIQUE INDEX "product_variants_productId_signature_key"
  ON "product_variants"("productId", "signature");
