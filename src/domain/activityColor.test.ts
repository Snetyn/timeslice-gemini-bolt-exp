import { describe, expect, it } from "vitest";
import { displayActivityColor } from "./activityColor";

describe("activity color intensity", () => {
  it("never rewrites standard stored colors", () => {
    expect(displayActivityColor("#6688aa", "standard")).toBe("#6688aa");
  });

  it("derives controlled vivid display colors without mutating input", () => {
    const stored = "hsl(220, 60%, 50%)";
    expect(displayActivityColor(stored, "vivid")).toBe("hsl(220, 73.2%, 50%)");
    expect(stored).toBe("hsl(220, 60%, 50%)");
  });
});
