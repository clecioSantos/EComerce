import { expect, test } from "@playwright/test";

test("catálogo exibe filtros e resultados", async ({ page }) => {
  await page.goto("/produtos");

  await expect(
    page.getByRole("heading", { level: 1, name: "Catálogo" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Filtros" })).toBeVisible();
});

test("busca retorna resultados", async ({ page }) => {
  await page.goto("/busca?q=camiseta");

  await expect(page).toHaveURL(/q=camiseta/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("camiseta");
});
