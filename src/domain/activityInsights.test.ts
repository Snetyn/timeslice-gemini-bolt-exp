import { describe, expect, it } from "vitest";
import type { ActivitySessionRecord } from "./activitySession";
import {
  buildActivityInsights,
  overlapDurationMs,
  periodBounds,
  roundedScaleMaximum,
} from "./activityInsights";

const record = (patch: Partial<ActivitySessionRecord>): ActivitySessionRecord => ({
  id: "record",
  sourceTimerId: "session",
  activityId: "activity",
  activityName: "Activity",
  source: "session",
  kind: "countdown",
  status: "completed",
  startedAtMs: 0,
  endedAtMs: 1,
  durationMs: 1,
  corrections: [],
  classificationCorrections: [],
  revision: 1,
  createdAtMs: 0,
  updatedAtMs: 1,
  ...patch,
});

describe("activity insights", () => {
  it("uses local Monday week and calendar month boundaries", () => {
    const wednesday = new Date(2026, 6, 22, 12).getTime();
    expect(new Date(periodBounds("week", wednesday).startMs).getDay()).toBe(1);
    expect(new Date(periodBounds("month", wednesday).startMs).getDate()).toBe(1);
  });

  it("splits cross-boundary intervals exactly and previews running time", () => {
    const now = new Date(2026, 6, 22, 12).getTime();
    const bounds = periodBounds("today", now);
    expect(
      overlapDurationMs(
        record({ startedAtMs: bounds.startMs - 60_000, endedAtMs: bounds.startMs + 30_000 }),
        bounds,
        now,
      ),
    ).toBe(30_000);
    expect(
      overlapDurationMs(record({ status: "running", startedAtMs: now - 5_000, endedAtMs: null }), bounds, now),
    ).toBe(5_000);
  });

  it("keeps unassigned honest and uses one shared chart scale", () => {
    const now = new Date(2026, 6, 22, 12).getTime();
    const insights = buildActivityInsights(
      [
        record({ id: "a", startedAtMs: now - 10_000, endedAtMs: now, durationMs: 10_000, lifeAreaId: "work", lifeAreaName: "Work" }),
        record({ id: "b", startedAtMs: now - 20_000, endedAtMs: now - 10_000, durationMs: 10_000 }),
        record({ id: "deleted", startedAtMs: now - 30_000, endedAtMs: now, deletedAtMs: now }),
      ],
      "today",
      now,
    );
    expect(insights.totalDurationMs).toBe(20_000);
    expect(insights.unassignedDurationMs).toBe(10_000);
    expect(insights.classifiedAreas.map((area) => area.name)).toEqual(["Work"]);
    expect(insights.scaleMaxMs).toBe(10_000);
  });

  it("rounds a deterministic common maximum", () => {
    expect(roundedScaleMaximum(61_000)).toBe(100_000);
    expect(roundedScaleMaximum(0)).toBe(60_000);
  });

  it("adds Momentum markers without changing actual duration or scale", () => {
    const now = new Date(2026, 6, 22, 12).getTime();
    const session = record({ startedAtMs: now - 10_000, endedAtMs: now, durationMs: 10_000, lifeAreaId: "work", lifeAreaName: "Work" });
    const base = buildActivityInsights([session], "today", now);
    const withMomentum = buildActivityInsights([session], "today", now, new Set(), [{ id: "m", decisionOpportunityId: "o", activityDefinitionId: "a", activityName: "Work", lifeAreaId: "work", source: "single", interaction: "suggested", confirmedAtMs: now, revision: 1, updatedAtMs: now }]);
    expect(withMomentum.momentumTotal).toBe(1);
    expect(withMomentum.totalDurationMs).toBe(base.totalDurationMs);
    expect(withMomentum.scaleMaxMs).toBe(base.scaleMaxMs);
  });
});
