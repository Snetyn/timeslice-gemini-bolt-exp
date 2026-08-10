import { describe, expect, it } from "vitest";
import { displayActivityColor, readableActivityColor } from "./activityColor";

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

describe("readable activity colors", () => {
  it.each(["#fff", "#ffffff", "rgb(255, 255, 255)", "hsl(0, 0%, 98%)"])(
    "replaces pale %s with a readable deterministic display color",
    (stored) => {
      const first = readableActivityColor(stored, "cleaning");
      const second = readableActivityColor(stored, "cleaning");
      expect(first).toEqual(second);
      expect(first.color).toMatch(/^hsl\(/);
      expect(first.color).not.toContain("100%)");
      expect(stored).toBe(stored);
    },
  );

  it("normalizes supported hex, RGB and HSL values without rewriting input", () => {
    const stored = ["#6688aa", "rgb(10, 120, 240)", "hsl(280, 60%, 50%)"];
    stored.forEach((color) => {
      const result = readableActivityColor(color, "task");
      expect(result.color).toMatch(/^hsl\(/);
      expect(["#ffffff", "#0f172a"]).toContain(result.textColor);
    });
    expect(stored).toEqual([
      "#6688aa",
      "rgb(10, 120, 240)",
      "hsl(280, 60%, 50%)",
    ]);
  });

  it("uses stable fallback colors for malformed values", () => {
    expect(readableActivityColor("not-a-color", "work")).toEqual(
      readableActivityColor(undefined, "work"),
    );
    expect(readableActivityColor(undefined, "work")).not.toEqual(
      readableActivityColor(undefined, "rest"),
    );
  });

  it("selects dark text for bright yellow display colors", () => {
    expect(readableActivityColor("hsl(60, 80%, 50%)", "yellow").textColor).toBe(
      "#0f172a",
    );
  });
});
