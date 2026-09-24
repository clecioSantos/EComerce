import { expect, test } from "@playwright/test";

/**
 * Requer banco de dados populado (npm run db:seed) e app em execução.
 */
test("abre a página de produto e mostra as variantes", async ({ page }) => {
  await page.goto("/produtos/camiseta-oversized");

  await expect(
    page.getByRole("heading", { level: 1, name: "Camiseta Oversized" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adicionar ao carrinho" }),
  ).toBeVisible();
});

test("adiciona produto ao carrinho", async ({ page }) => {
  await page.goto("/produtos/camiseta-oversized");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();

  await expect(page.getByText(/adicionado ao carrinho/i)).toBeVisible();

  await page.goto("/carrinho");
  await expect(page.getByRole("heading", { name: "Carrinho" })).toBeVisible();
});
