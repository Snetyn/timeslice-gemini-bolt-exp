import { describe, expect, it } from "vitest";
import {
  adaptiveEstimateSeconds,
  normalizeTaskOccurrence,
  planCapacity,
  recurrenceMatchesDate,
  suggestTaskPlacements,
  type DailyPlanRecord,
  type TaskOccurrenceRecord,
} from "./taskPlanning";

const occurrence = (
  changes: Partial<TaskOccurrenceRecord> = {},
): TaskOccurrenceRecord => ({
  id: changes.id || crypto.randomUUID(),
  activityDefinitionId: null,
  title: "Task",
  color: "#6366f1",
  tagIds: [],
  folderId: null,
  status: "planned",
  localDate: "2026-08-09",
  schedulingMode: "flexible",
  exactStartMinutes: null,
  windowStartMinutes: null,
  windowEndMinutes: null,
  plannedDurationSeconds: 3600,
  minimumDurationSeconds: 1800,
  durationOverrideSeconds: null,
  durationMode: "fixed",
  placementStartMinutes: null,
  actualFocusedSeconds: 0,
  completedAtMs: null,
  completionSnapshot: null,
  skippedDueDates: [],
  recurrenceKey: null,
  revision: 1,
  createdAtMs: 1,
  updatedAtMs: 1,
  ...changes,
});

const plan: DailyPlanRecord = {
  id: "day:2026-08-09",
  localDate: "2026-08-09",
  windowStartMinutes: 480,
  windowEndMinutes: 720,
  capacityOverrideSeconds: null,
  confirmedAtMs: null,
  revision: 1,
  createdAtMs: 1,
  updatedAtMs: 1,
};

describe("shared task planning", () => {
  it("normalizes malformed occurrence values without changing its identity", () => {
    expect(
      normalizeTaskOccurrence({
        ...occurrence({ id: "stable" }),
        plannedDurationSeconds: Number.NaN,
        tagIds: ["a", "", "a", 7],
      }),
    ).toMatchObject({
      id: "stable",
      plannedDurationSeconds: 3600,
      tagIds: ["a"],
    });
  });

  it("computes simple lifetime estimates by occurrence after fragments were summed", () => {
    expect(
      adaptiveEstimateSeconds(
        [
          occurrence({ status: "completed", actualFocusedSeconds: 31 * 60 }),
          occurrence({ status: "completed", actualFocusedSeconds: 44 * 60 }),
          occurrence({ status: "active", actualFocusedSeconds: 300 * 60 }),
          occurrence({ status: "completed", actualFocusedSeconds: 0 }),
        ],
        60 * 60,
        40 * 60,
      ),
    ).toBe(40 * 60);
  });

  it("reports shortfall and only adaptive reduction headroom", () => {
    const result = planCapacity(plan, [
      occurrence({ plannedDurationSeconds: 3 * 3600, durationMode: "fixed" }),
      occurrence({
        plannedDurationSeconds: 2 * 3600,
        minimumDurationSeconds: 3600,
        durationMode: "adaptive",
      }),
    ]);
    expect(result).toMatchObject({
      availableSeconds: 4 * 3600,
      plannedSeconds: 5 * 3600,
      shortfallSeconds: 3600,
      reducibleSeconds: 3600,
    });
  });

  it("blocks exact overlaps and places windowed tasks in the earliest valid gap", () => {
    const result = suggestTaskPlacements(plan, [
      occurrence({
        id: "fixed",
        schedulingMode: "exact",
        exactStartMinutes: 480,
        plannedDurationSeconds: 3600,
      }),
      occurrence({
        id: "overlap",
        schedulingMode: "exact",
        exactStartMinutes: 510,
        plannedDurationSeconds: 1800,
      }),
      occurrence({
        id: "window",
        schedulingMode: "window",
        windowStartMinutes: 480,
        windowEndMinutes: 720,
        plannedDurationSeconds: 1800,
      }),
    ]);
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ occurrenceId: "overlap", kind: "overlap" }),
      ]),
    );
    expect(
      result.occurrences.find((item) => item.id === "window")
        ?.placementStartMinutes,
    ).toBe(540);
  });

  it("supports local recurrence rules including interval anchors", () => {
    expect(
      recurrenceMatchesDate({ type: "weekdays", days: [1] }, "2026-08-10"),
    ).toBe(true);
    expect(
      recurrenceMatchesDate({ type: "monthly", days: [9] }, "2026-08-09"),
    ).toBe(true);
    expect(
      recurrenceMatchesDate({ type: "yearly", dates: ["08-09"] }, "2026-08-09"),
    ).toBe(true);
    expect(
      recurrenceMatchesDate(
        { type: "interval", everyDays: 3, anchorDate: "2026-08-01" },
        "2026-08-10",
      ),
    ).toBe(true);
  });
});
