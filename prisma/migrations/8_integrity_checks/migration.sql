-- Invariantes de estoque. Compatíveis com allowBackorder: se o backorder está
-- habilitado, o físico pode ficar negativo (regra preservada).
ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_quantityReserved_nonnegative"
    CHECK ("quantityReserved" >= 0),
  ADD CONSTRAINT "inventory_onHand_nonnegative_unless_backorder"
    CHECK ("allowBackorder" OR "quantityOnHand" >= 0),
  ADD CONSTRAINT "inventory_reserved_lte_onhand_unless_backorder"
    CHECK ("allowBackorder" OR "quantityReserved" <= "quantityOnHand");

-- Reserva deve ter quantidade positiva.
ALTER TABLE "stock_reservations"
  ADD CONSTRAINT "stock_reservations_quantity_positive"
    CHECK ("quantity" > 0);

-- Um único carrinho ACTIVE por usuário (convidados têm userId NULL e não entram).
CREATE UNIQUE INDEX "carts_userId_active_key"
  ON "carts"("userId")
  WHERE "userId" IS NOT NULL AND "status" = 'ACTIVE';
