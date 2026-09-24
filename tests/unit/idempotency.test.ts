import { describe, expect, it } from "vitest";

import { computeRequestHash } from "@/modules/checkout/idempotency";

describe("computeRequestHash", () => {
  it("é estável independentemente da ordem das chaves", () => {
    const a = computeRequestHash({ b: 2, a: 1, nested: { y: 2, x: 1 } });
    const b = computeRequestHash({ nested: { x: 1, y: 2 }, a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("difere quando o conteúdo muda", () => {
    expect(computeRequestHash({ total: 100 })).not.toBe(
      computeRequestHash({ total: 150 }),
    );
  });

  it("considera a ordem dos itens (array significativo)", () => {
    const first = computeRequestHash({
      items: [
        { variantId: "v1", quantity: 1 },
        { variantId: "v2", quantity: 1 },
      ],
    });
    const second = computeRequestHash({
      items: [
        { variantId: "v2", quantity: 1 },
        { variantId: "v1", quantity: 1 },
      ],
    });
    expect(first).not.toBe(second);
  });

  it("ignora chaves com valor undefined", () => {
    const withUndefined = computeRequestHash({ a: 1, b: undefined });
    const without = computeRequestHash({ a: 1 });
    expect(withUndefined).toBe(without);
  });
});
