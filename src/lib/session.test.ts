import { describe, expect, it } from "vitest";
import { buildProgressEntries, distributeEarlyCompletion } from "./session";

describe("session progress model", () => {
  it("keeps a zero count-up task out of planned and dynamic geometry", () => {
    const [entry] = buildProgressEntries(
      [{ id: "up", countUp: true, timeRemaining: 0 }],
      600,
    );
    expect(entry).toMatchObject({
      plannedSeconds: 0,
      elapsedSeconds: 0,
      visibleInPlan: false,
    });
  });

  it("uses elapsed count-up time only after it exists", () => {
    const [entry] = buildProgressEntries(
      [{ id: "up", countUp: true, timeRemaining: 42 }],
      600,
    );
    expect(entry.elapsedSeconds).toBe(42);
  });

  it("distributes early-completion time without changing the total remaining work", () => {
    const result = distributeEarlyCompletion(
      [
        { id: "done", timeRemaining: 0, isCompleted: true },
        { id: "first", timeRemaining: 30 },
        { id: "second", timeRemaining: 90 },
      ],
      "done",
      60,
      "distribute",
    );
    expect(result.vaultSeconds).toBe(0);
    expect(result.activities.map((item) => item.timeRemaining)).toEqual([
      0, 45, 135,
    ]);
  });

  it("falls back to distributing when a target no longer exists", () => {
    const result = distributeEarlyCompletion(
      [
        { id: "done", isCompleted: true },
        { id: "next", timeRemaining: 10 },
      ],
      "done",
      20,
      "target",
      "missing",
    );
    expect(result.activities[1].timeRemaining).toBe(30);
  });
});
