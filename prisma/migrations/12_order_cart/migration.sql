-- Referência ao carrinho de origem, para esvaziá-lo apenas quando o pagamento
-- for confirmado (PAID), preservando os itens em caso de falha.

ALTER TABLE "orders" ADD COLUMN "cartId" TEXT;

CREATE INDEX "orders_cartId_idx" ON "orders"("cartId");
