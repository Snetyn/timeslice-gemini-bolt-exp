import { describe, expect, it } from "vitest";
import {
  activitySessionDurationMs,
  adHocActivityId,
  normalizeActivitySessionRecord,
} from "./activitySession";

describe("activity session domain", () => {
  it("rejects invalid records and normalizes unsafe numeric values", () => {
    expect(
      normalizeActivitySessionRecord({ activityId: "missing" }),
    ).toBeNull();
    expect(
      normalizeActivitySessionRecord({
        id: "record",
        sourceTimerId: "session",
        activityId: "focus",
        activityName: "Focus",
        source: "session",
        kind: "countdown",
        status: "completed",
        startedAtMs: Number.NaN,
        endedAtMs: -20,
        durationMs: Number.POSITIVE_INFINITY,
      }),
    ).toMatchObject({
      startedAtMs: 0,
      endedAtMs: 0,
      durationMs: 0,
    });
  });

  it("derives a running duration without persisting per-second updates", () => {
    const record = normalizeActivitySessionRecord({
      id: "record",
      sourceTimerId: "single",
      activityId: "adhoc:read",
      activityName: "Read",
      source: "single",
      kind: "count-up",
      status: "running",
      startedAtMs: 1_000,
      endedAtMs: null,
      durationMs: 0,
    });
    expect(record && activitySessionDurationMs(record, 6_500)).toBe(5_500);
  });

  it("reuses normalized quick-activity names", () => {
    expect(adHocActivityId("  Read a Book ")).toBe("adhoc:read-a-book");
    expect(adHocActivityId("READ A BOOK")).toBe("adhoc:read-a-book");
  });

  it("preserves validated Free Flow classification context", () => {
    expect(
      normalizeActivitySessionRecord({
        id: "free-flow-record",
        sourceTimerId: "free-flow:run",
        activityId: "action",
        activityName: "Clear desk",
        source: "quick-action",
        kind: "standard",
        status: "completed",
        startedAtMs: 1_000,
        endedAtMs: 3_000,
        durationMs: 2_000,
        freeFlowRunId: "run",
        actionId: "action",
        actionOrigin: "quick-action",
        suggestedActionClass: "quick",
        actionClass: "hard",
      }),
    ).toMatchObject({
      source: "quick-action",
      freeFlowRunId: "run",
      actionId: "action",
      actionClass: "hard",
    });
  });
});
