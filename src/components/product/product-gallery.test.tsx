import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductGallery } from "./product-gallery";

afterEach(cleanup);

const images = [
  { url: "/front.jpg", alt: "Vista frontal" },
  { url: "/back.jpg", alt: "Vista posterior" },
];

describe("ProductGallery", () => {
  it("selects thumbnails and cycles from the first photo to the last", () => {
    render(<ProductGallery title="Camisa" images={images} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver imagem 2 de Camisa" }));
    expect(screen.getByRole("img", { name: "Vista posterior" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Ver imagem 2 de Camisa" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Próxima imagem" }));
    expect(screen.getByRole("img", { name: "Vista frontal" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Imagem anterior" }));
    expect(screen.getByRole("img", { name: "Vista posterior" })).toBeVisible();
  });

  it("opens the enlarged photo and supports keyboard navigation and Escape", async () => {
    render(<ProductGallery title="Camisa" images={images} />);
    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagem de Camisa" }));
    const dialog = await screen.findByRole("dialog", { name: "Camisa" });
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(within(dialog).getByRole("img", { name: "Vista posterior" })).toBeVisible();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("handles a product without photos", () => {
    render(<ProductGallery title="Camisa" images={[]} />);
    expect(screen.getByText("Sem imagem")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
