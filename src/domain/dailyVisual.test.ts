import { describe, expect, it } from "vitest";
import { buildDailyVisualModel } from "./dailyVisual";

const task = (
  id: string,
  plannedSeconds: number,
  actualSeconds = 0,
  status = "scheduled",
  color = "#ffffff",
) => ({ id, name: id, plannedSeconds, actualSeconds, status, color });

describe("Daily visual model", () => {
  it("keeps task order and fixed planned shares while progress changes", () => {
    const initial = buildDailyVisualModel({
      activities: [task("work", 1800), task("walk", 600)],
      scope: "tasks",
    });
    const advanced = buildDailyVisualModel({
      activities: [task("work", 1800, 900, "active"), task("walk", 600)],
      scope: "tasks",
    });
    expect(initial.segments.map(({ id }) => id)).toEqual(["work", "walk"]);
    expect(initial.segments.map(({ share }) => share)).toEqual([0.75, 0.25]);
    expect(advanced.segments.map(({ share }) => share)).toEqual([0.75, 0.25]);
    expect(advanced.progress).toBeCloseTo(0.375);
    expect(advanced.totalRemainingSeconds).toBe(1500);
  });

  it("adds neutral free time only in full-day scope", () => {
    const model = buildDailyVisualModel({
      activities: [task("work", 1800)],
      scope: "full",
      capacitySeconds: 3600,
    });
    expect(model.freeSeconds).toBe(1800);
    expect(model.segments.map(({ id }) => id)).toEqual([
      "work",
      "daily-free-time",
    ]);
    expect(model.segments.map(({ share }) => share)).toEqual([0.5, 0.5]);
    expect(model.segments[1]).toMatchObject({
      color: "#cbd5e1",
      isFreeTime: true,
    });
  });

  it("reports overbooking without producing negative free time", () => {
    const model = buildDailyVisualModel({
      activities: [task("work", 2700), task("walk", 1800)],
      scope: "full",
      capacitySeconds: 3600,
    });
    expect(model.freeSeconds).toBe(0);
    expect(model.overbookedSeconds).toBe(900);
    expect(model.segments.reduce((sum, item) => sum + item.share, 0)).toBe(1);
  });

  it("credits completed work and preserves overtime actual time", () => {
    const model = buildDailyVisualModel({
      activities: [
        task("done", 600, 120, "completed"),
        task("late", 600, 900, "overtime"),
      ],
      scope: "tasks",
    });
    expect(model.progress).toBe(1);
    expect(model.totalActualSeconds).toBe(1020);
    expect(model.totalCreditedSeconds).toBe(1200);
    expect(model.segments[1]).toMatchObject({
      remainingSeconds: 0,
      status: "overtime",
    });
  });

  it("filters completed and invalid zero-duration entries safely", () => {
    const model = buildDailyVisualModel({
      activities: [
        task("done", 600, 600, "completed"),
        task("zero", 0),
        task("invalid", Number.NaN),
        task("next", 300),
      ],
      scope: "tasks",
      hideCompleted: true,
    });
    expect(model.segments.map(({ id }) => id)).toEqual(["next"]);
    expect(model.progress).toBe(0);
    expect(Number.isFinite(model.segments[0].share)).toBe(true);
  });

  it("uses a stable empty model instead of NaN geometry", () => {
    const model = buildDailyVisualModel({ activities: [], scope: "tasks" });
    expect(model.segments).toEqual([]);
    expect(model.progress).toBe(0);
    expect(model.totalRemainingSeconds).toBe(0);
  });
});
