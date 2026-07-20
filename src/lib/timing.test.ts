import { describe, expect, it } from "vitest";
import { clampSeconds, isNewDay, secondsBetween } from "./timing";

describe("timing helpers", () => {
  it("never returns a negative elapsed duration", () => {
    expect(secondsBetween(Date.now() + 10_000, Date.now())).toBe(0);
  });

  it("normalizes unsafe second values", () => {
    expect(clampSeconds(-4)).toBe(0);
    expect(clampSeconds(12.9, 10)).toBe(10);
    expect(clampSeconds(Number.NaN)).toBe(0);
  });

  it("detects a daily rollover using the local day label", () => {
    expect(isNewDay("Mon Jan 01 2024", new Date("2024-01-02T10:00:00"))).toBe(
      true,
    );
    expect(isNewDay("Tue Jan 02 2024", new Date("2024-01-02T10:00:00"))).toBe(
      false,
    );
  });
});
