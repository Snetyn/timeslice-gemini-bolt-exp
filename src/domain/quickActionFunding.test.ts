import { describe, expect, it } from "vitest";
import { fundQuickActionElapsed } from "./quickActionFunding";

const activities = () => [
  { id: "current", timeRemaining: 20 },
  { id: "next", timeRemaining: 30 },
  { id: "protected", timeRemaining: 50, priority: true },
  { id: "locked", timeRemaining: 10, locked: true },
];

describe("Session Quick Action funding", () => {
  it("charges a direct current source and reports overtime", () => {
    const result = fundQuickActionElapsed({
      activities: activities(),
      currentActivityIndex: 0,
      mode: "current",
      elapsedSeconds: 25,
      vaultSeconds: 0,
    });
    expect(result.fundedSeconds).toBe(20);
    expect(result.overtimeSeconds).toBe(5);
    expect(result.activities[0].timeRemaining).toBe(0);
  });

  it("requires an override for a protected current source", () => {
    const blocked = fundQuickActionElapsed({
      activities: activities(),
      currentActivityIndex: 2,
      mode: "current",
      elapsedSeconds: 5,
      vaultSeconds: 0,
    });
    const allowed = fundQuickActionElapsed({
      activities: activities(),
      currentActivityIndex: 2,
      mode: "current",
      elapsedSeconds: 5,
      vaultSeconds: 0,
      allowProtectedCurrent: true,
    });
    expect(blocked.fundedSeconds).toBe(0);
    expect(allowed.fundedSeconds).toBe(5);
  });

  it("respects lock for direct funding but not automatic funding", () => {
    const direct = fundQuickActionElapsed({
      activities: activities(),
      currentActivityIndex: 3,
      mode: "current",
      elapsedSeconds: 10,
      vaultSeconds: 0,
    });
    const proportional = fundQuickActionElapsed({
      activities: activities(),
      currentActivityIndex: 0,
      mode: "proportional",
      elapsedSeconds: 60,
      vaultSeconds: 0,
    });
    expect(direct.fundedSeconds).toBe(0);
    expect(proportional.fundedSeconds).toBe(60);
    expect(proportional.activities[2].timeRemaining).toBe(50);
    expect(proportional.activities[3].timeRemaining).toBe(0);
  });

  it("uses deterministic proportional integer rounding", () => {
    const result = fundQuickActionElapsed({
      activities: [
        { id: "a", timeRemaining: 2 },
        { id: "b", timeRemaining: 1 },
      ],
      currentActivityIndex: 0,
      mode: "proportional",
      elapsedSeconds: 2,
      vaultSeconds: 0,
    });
    expect(result.trace).toEqual([
      { activityId: "a", seconds: 1, offsetSeconds: 0 },
      { activityId: "b", seconds: 1, offsetSeconds: 0 },
    ]);
  });

  it("keeps a configured minimum balance", () => {
    const result = fundQuickActionElapsed({
      activities: [{ id: "a", timeRemaining: 10 }],
      currentActivityIndex: 0,
      mode: "current",
      elapsedSeconds: 10,
      vaultSeconds: 0,
      minimumBalanceSeconds: 3,
    });
    expect(result.fundedSeconds).toBe(7);
    expect(result.activities[0].timeRemaining).toBe(3);
  });

  it("drains only Session Time Vault when selected", () => {
    const result = fundQuickActionElapsed({
      activities: activities(),
      currentActivityIndex: 0,
      mode: "vault",
      elapsedSeconds: 8,
      vaultSeconds: 5,
    });
    expect(result.vaultSeconds).toBe(0);
    expect(result.fundedSeconds).toBe(5);
    expect(result.overtimeSeconds).toBe(3);
  });

  it("preserves the scheduled end while the action is funded", () => {
    const before = activities();
    const beforeRemaining = before.reduce(
      (sum, activity) => sum + activity.timeRemaining,
      0,
    );
    const result = fundQuickActionElapsed({
      activities: before,
      currentActivityIndex: 0,
      mode: "proportional",
      elapsedSeconds: 12,
      vaultSeconds: 0,
    });
    const afterRemaining = result.activities.reduce(
      (sum, activity) => sum + activity.timeRemaining,
      0,
    );
    // Wall clock advanced 12s while remaining work shrank 12s.
    expect(afterRemaining).toBe(beforeRemaining - 12);
    expect(result.overtimeSeconds).toBe(0);
  });
});
