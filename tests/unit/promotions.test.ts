import { describe, expect, it } from "vitest";

import {
  isCouponActive,
  isPromotionActive,
  isWithinPeriod,
  validateCouponEligibility,
  type CouponLike,
} from "@/modules/promotions/schemas";

const now = new Date("2026-06-15T12:00:00Z");

describe("isWithinPeriod", () => {
  it("valida o período", () => {
    expect(isWithinPeriod(null, null, now)).toBe(true);
    expect(
      isWithinPeriod(new Date("2026-01-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"), now),
    ).toBe(true);
    expect(isWithinPeriod(new Date("2027-01-01T00:00:00Z"), null, now)).toBe(false);
    expect(isWithinPeriod(null, new Date("2025-01-01T00:00:00Z"), now)).toBe(false);
  });
});

describe("isPromotionActive", () => {
  it("considera flag e período", () => {
    expect(
      isPromotionActive({ type: "PERCENTAGE", scope: "CART", value: 10 }, now),
    ).toBe(true);
    expect(
      isPromotionActive(
        { type: "PERCENTAGE", scope: "CART", value: 10, isActive: false },
        now,
      ),
    ).toBe(false);
  });
});

describe("validateCouponEligibility", () => {
  const base: CouponLike = {
    code: "BEMVINDO10",
    type: "PERCENTAGE",
    value: 10,
    isActive: true,
  };

  it("valida cupom disponível", () => {
    const result = validateCouponEligibility({ coupon: base, subtotal: 200, now });
    expect(result.valid).toBe(true);
    expect(result.code).toBe("OK");
  });

  it("rejeita cupom inexistente", () => {
    const result = validateCouponEligibility({ coupon: null, subtotal: 200, now });
    expect(result.code).toBe("NOT_FOUND");
  });

  it("rejeita cupom inativo", () => {
    const result = validateCouponEligibility({
      coupon: { ...base, isActive: false },
      subtotal: 200,
      now,
    });
    expect(result.code).toBe("INACTIVE");
  });

  it("rejeita cupom expirado", () => {
    const result = validateCouponEligibility({
      coupon: { ...base, endsAt: new Date("2025-01-01T00:00:00Z") },
      subtotal: 200,
      now,
    });
    expect(result.code).toBe("EXPIRED");
  });

  it("rejeita subtotal abaixo do mínimo", () => {
    const result = validateCouponEligibility({
      coupon: { ...base, minSubtotal: 500 },
      subtotal: 200,
      now,
    });
    expect(result.code).toBe("MIN_SUBTOTAL");
  });

  it("rejeita cupom esgotado", () => {
    const result = validateCouponEligibility({
      coupon: { ...base, maxUses: 5, usedCount: 5 },
      subtotal: 200,
      now,
    });
    expect(result.code).toBe("USAGE_LIMIT");
  });

  it("rejeita limite por usuário", () => {
    const result = validateCouponEligibility({
      coupon: { ...base, maxUsesPerUser: 1 },
      subtotal: 200,
      userUsageCount: 1,
      now,
    });
    expect(result.code).toBe("USER_LIMIT");
  });
});

describe("isCouponActive", () => {
  it("considera flag e período", () => {
    expect(
      isCouponActive(
        { code: "X", type: "FIXED_AMOUNT", value: 5, isActive: true },
        now,
      ),
    ).toBe(true);
    expect(
      isCouponActive(
        {
          code: "X",
          type: "FIXED_AMOUNT",
          value: 5,
          isActive: true,
          endsAt: new Date("2020-01-01T00:00:00Z"),
        },
        now,
      ),
    ).toBe(false);
  });
});
