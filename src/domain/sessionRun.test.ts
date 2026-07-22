import { describe, expect, it } from "vitest";
import { advanceSessionRun, type SessionRunActivity } from "./sessionRun";

const task = (
  id: string,
  remaining: number,
  extra: Partial<SessionRunActivity> = {},
): SessionRunActivity => ({
  id,
  name: id,
  duration: remaining / 60,
  timeRemaining: remaining,
  ...extra,
});

describe("session run batch transition", () => {
  it("uses the same batch to complete multiple countdown tasks", () => {
    const result = advanceSessionRun({
      activities: [task("first", 2), task("second", 4)],
      currentActivityIndex: 0,
      elapsedSeconds: 5,
      overtimeMode: "none",
    });
    expect(result.activities).toMatchObject([
      { id: "first", timeRemaining: 0, isCompleted: true },
      { id: "second", timeRemaining: 1 },
    ]);
    expect(result.currentActivityIndex).toBe(1);
    expect(result.completedActivityIds).toEqual(["first"]);
    expect(result.activitySlices).toEqual([
      {
        activityId: "first",
        offsetSeconds: 0,
        durationSeconds: 2,
        kind: "countdown",
      },
      {
        activityId: "second",
        offsetSeconds: 2,
        durationSeconds: 3,
        kind: "countdown",
      },
    ]);
  });

  it("keeps a count-up stable at zero and applies a later batch once", () => {
    const zero = advanceSessionRun({
      activities: [task("up", 0, { countUp: true })],
      currentActivityIndex: 0,
      elapsedSeconds: 0,
      overtimeMode: "none",
    });
    expect(zero.activities[0].timeRemaining).toBe(0);
    expect(zero.activitySlices).toEqual([]);

    const advanced = advanceSessionRun({
      activities: zero.activities,
      currentActivityIndex: 0,
      elapsedSeconds: 42,
      overtimeMode: "none",
    });
    expect(advanced.activities[0].timeRemaining).toBe(42);
    expect(advanced.activitySlices).toEqual([
      {
        activityId: "up",
        offsetSeconds: 0,
        durationSeconds: 42,
        kind: "count-up",
      },
    ]);
  });

  it("postpones Session work for exactly the Flowmodoro break batch", () => {
    const result = advanceSessionRun({
      activities: [task("focus", 20)],
      currentActivityIndex: 0,
      elapsedSeconds: 8,
      overtimeMode: "none",
      flowBreakMode: "postpone",
      flowBreakRemainingSeconds: 5,
    });
    expect(result.activities[0].timeRemaining).toBe(17);
    expect(result.excludedSeconds).toBe(5);
    expect(result.activitySlices).toEqual([
      {
        activityId: "focus",
        offsetSeconds: 5,
        durationSeconds: 3,
        kind: "countdown",
      },
    ]);
  });

  it("drains Vault first and then only one eligible Flow source", () => {
    const result = advanceSessionRun({
      activities: [task("first", 10), task("second", 10)],
      currentActivityIndex: 0,
      elapsedSeconds: 7,
      overtimeMode: "none",
      flowBreakMode: "drain",
      flowBreakRemainingSeconds: 7,
      vaultSeconds: 2,
    });
    expect(result.vaultSeconds).toBe(0);
    expect(result.activities.map((activity) => activity.timeRemaining)).toEqual(
      [5, 10],
    );
    expect(result.donatedSecondsById).toEqual({ first: 5 });
    expect(result.flowDrainSourceId).toBe("first");
    expect(result.excludedSeconds).toBe(7);
    expect(result.activitySlices).toEqual([]);
  });

  it("records deterministic overtime drain transfers", () => {
    const result = advanceSessionRun({
      activities: [task("overtime", 0), task("donor", 5)],
      currentActivityIndex: 0,
      elapsedSeconds: 3,
      overtimeMode: "drain",
    });
    expect(result.activities.map((activity) => activity.timeRemaining)).toEqual(
      [-3, 2],
    );
    expect(result.donatedSecondsById).toEqual({ donor: 3 });
    expect(result.receivedSecondsById).toEqual({ overtime: 3 });
    expect(result.activitySlices).toEqual([
      {
        activityId: "overtime",
        offsetSeconds: 0,
        durationSeconds: 3,
        kind: "overtime",
      },
    ]);
  });

  it("characterizes the existing overtime donor tiers and top-first tie break", () => {
    const result = advanceSessionRun({
      activities: [
        task("overtime", 0),
        task("first", 2),
        task("second", 2),
        task("starred", 2, { priority: true }),
        task("locked", 2, { isLocked: true }),
      ],
      currentActivityIndex: 0,
      elapsedSeconds: 3,
      overtimeMode: "drain",
    });
    expect(result.donatedSecondsById).toEqual({
      first: 1,
      second: 1,
      locked: 1,
    });
    expect(result.activities.find((item) => item.id === "starred"))
      .toMatchObject({ timeRemaining: 2 });
    expect(result.activities.find((item) => item.id === "locked"))
      .toMatchObject({ timeRemaining: 1 });
  });

  it("traces postponed overtime without splitting a contiguous slice", () => {
    const result = advanceSessionRun({
      activities: [task("focus", 2)],
      currentActivityIndex: 0,
      elapsedSeconds: 5,
      overtimeMode: "postpone",
    });
    expect(result.activities[0].timeRemaining).toBe(-3);
    expect(result.activitySlices).toEqual([
      {
        activityId: "focus",
        offsetSeconds: 0,
        durationSeconds: 2,
        kind: "countdown",
      },
      {
        activityId: "focus",
        offsetSeconds: 2,
        durationSeconds: 3,
        kind: "overtime",
      },
    ]);
  });

  it("sanitizes invalid remaining values before advancing", () => {
    const result = advanceSessionRun({
      activities: [task("broken", Number.NaN, { duration: 1 })],
      currentActivityIndex: 0,
      elapsedSeconds: 1,
      overtimeMode: "none",
    });
    expect(result.activities[0].timeRemaining).toBe(59);
  });
});
