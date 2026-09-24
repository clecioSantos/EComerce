-- DropIndex
DROP INDEX "product_variant_attributes_attributeId_idx";

-- CreateIndex
CREATE INDEX "product_variant_attributes_attributeId_attributeValueId_idx" ON "product_variant_attributes"("attributeId", "attributeValueId");

-- CreateIndex
CREATE INDEX "products_status_categoryId_idx" ON "products"("status", "categoryId");

-- CreateIndex
CREATE INDEX "products_status_productTypeId_idx" ON "products"("status", "productTypeId");

-- CreateIndex
CREATE INDEX "products_status_createdAt_idx" ON "products"("status", "createdAt");

