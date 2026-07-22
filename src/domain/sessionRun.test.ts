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
  });

  it("keeps a count-up stable at zero and applies a later batch once", () => {
    const zero = advanceSessionRun({
      activities: [task("up", 0, { countUp: true })],
      currentActivityIndex: 0,
      elapsedSeconds: 0,
      overtimeMode: "none",
    });
    expect(zero.activities[0].timeRemaining).toBe(0);

    const advanced = advanceSessionRun({
      activities: zero.activities,
      currentActivityIndex: 0,
      elapsedSeconds: 42,
      overtimeMode: "none",
    });
    expect(advanced.activities[0].timeRemaining).toBe(42);
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
