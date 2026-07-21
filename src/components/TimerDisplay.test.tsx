import { describe, expect, it } from "vitest";
import { clampProgress, normalizeTimerSegments } from "./TimerDisplay";

describe("timer display model", () => {
  it("clamps invalid and out-of-range progress", () => {
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(140)).toBe(100);
  });

  it("normalizes positive segment values and ignores empty segments", () => {
    const segments = normalizeTimerSegments([
      { id: "first", label: "First", color: "#111", value: 3 },
      { id: "empty", label: "Empty", color: "#222", value: 0 },
      { id: "second", label: "Second", color: "#333", value: 1 },
    ]);
    expect(segments.map((segment) => segment.id)).toEqual(["first", "second"]);
    expect(segments.map((segment) => segment.percentage)).toEqual([75, 25]);
  });
});
