import { expect, test } from "@playwright/test";

test("home carrega e exibe a apresentação da plataforma", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /e-commerce modular/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver a demonstração" }),
  ).toBeVisible();
});

test("navega da home para o catálogo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver a demonstração" }).click();

  await expect(page).toHaveURL(/\/produtos/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Catálogo" }),
  ).toBeVisible();
});
