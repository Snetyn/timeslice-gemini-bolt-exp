import { describe, expect, it } from "vitest";
import {
  REPORT_FALLBACK_COLOR,
  buildReportWheelSegments,
  getVisibleArcLength,
  normalizeReportView,
  type SessionReportRow,
} from "./sessionReport";

const row = (
  id: string,
  planned: number,
  actual: number,
  color?: string,
): SessionReportRow => ({
  id,
  name: id,
  color,
  planned,
  actual,
  delta: actual - planned,
  overtimeSeconds: 0,
  drainedSeconds: 0,
  receivedOvertime: 0,
});

describe("session report task wheel", () => {
  it("keeps task order and normalizes planned and actual rings independently", () => {
    const segments = buildReportWheelSegments([
      row("first", 90, 30, "#111111"),
      row("second", 30, 90, "#222222"),
    ]);

    expect(segments.map((segment) => segment.id)).toEqual(["first", "second"]);
    expect(segments[0]).toMatchObject({
      plannedShare: 75,
      actualShare: 25,
      plannedOffset: 0,
      actualOffset: 0,
    });
    expect(segments[1]).toMatchObject({
      plannedShare: 25,
      actualShare: 75,
      plannedOffset: 75,
      actualOffset: 25,
    });
  });

  it("places planned-zero count-up work only on the actual ring", () => {
    const [segment] = buildReportWheelSegments([row("count-up", 0, 75)]);
    expect(segment.plannedShare).toBe(0);
    expect(segment.actualShare).toBe(100);
  });

  it("places untouched planned work only on the planned ring", () => {
    const [segment] = buildReportWheelSegments([row("not-started", 120, 0)]);
    expect(segment.plannedShare).toBe(100);
    expect(segment.actualShare).toBe(0);
  });

  it("sanitizes invalid values and uses stable fallback metadata", () => {
    const segments = buildReportWheelSegments([
      {
        ...row("", Number.NaN, 30),
        id: "",
        name: "",
        color: "",
      },
      row("empty", 0, 0),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      id: "task-1",
      name: "Task 1",
      color: REPORT_FALLBACK_COLOR,
      planned: 0,
      actual: 30,
      delta: 30,
    });
    expect(
      [
        segments[0].plannedShare,
        segments[0].actualShare,
        segments[0].plannedOffset,
        segments[0].actualOffset,
      ].every(Number.isFinite),
    ).toBe(true);
  });

  it("keeps tiny segments visible without allowing the gap to consume them", () => {
    expect(getVisibleArcLength(0.05, 8)).toBeGreaterThan(0);
    expect(getVisibleArcLength(0.05, 8)).toBeLessThanOrEqual(0.05);
    expect(getVisibleArcLength(100, 1)).toBe(100);
    expect(getVisibleArcLength(Number.NaN, 2)).toBe(0);
  });

  it("uses summary as the safe persisted-view fallback", () => {
    expect(normalizeReportView("tasks")).toBe("tasks");
    expect(normalizeReportView("unknown")).toBe("summary");
    expect(normalizeReportView(undefined)).toBe("summary");
  });
});
