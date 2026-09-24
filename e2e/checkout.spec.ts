import { expect, test } from "@playwright/test";

/**
 * Fluxo completo de checkout como convidado.
 * Requer banco populado (npm run db:seed) e app em execução.
 */
test("checkout completo: produto -> carrinho -> pedido", async ({ page }) => {
  // 1. Produto
  await page.goto("/produtos/camiseta-oversized");
  await expect(
    page.getByRole("heading", { level: 1, name: "Camiseta Oversized" }),
  ).toBeVisible();

  // 2. Adicionar ao carrinho
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByText(/adicionado ao carrinho/i)).toBeVisible();

  // 3. Carrinho
  await page.goto("/carrinho");
  await expect(page.getByRole("heading", { name: "Carrinho" })).toBeVisible();
  await page.getByRole("button", { name: "Ir para o checkout" }).click();

  // 4. Checkout
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

  await page.getByLabel("Nome completo").fill("Cliente E2E");
  await page.getByLabel("E-mail").fill("e2e@test.local");
  await page.getByLabel("Telefone").fill("11999999999");
  await page.getByLabel("Destinatário").fill("Cliente E2E");
  await page.getByLabel("Endereço").fill("Rua Teste, 123");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("Estado").fill("SP");
  await page.getByLabel("CEP").fill("01000-000");

  // 5. Finalizar (o provedor de pagamento mock aprova automaticamente)
  await page.getByRole("button", { name: "Finalizar pedido" }).click();

  // 6. Sucesso
  await expect(page).toHaveURL(/\/checkout\/sucesso\?orderId=/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: /Pedido confirmado/i }),
  ).toBeVisible();
  await expect(page.getByText(/Pago|Aguardando pagamento/)).toBeVisible();
});
