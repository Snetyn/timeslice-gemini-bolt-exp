import { describe, expect, it } from "vitest";
import {
  calculateAllocation,
  confirmAllocation,
  type AllocationActivity,
} from "./timeAllocation";

const activities: AllocationActivity[] = [
  { id: "top", name: "Top", timeRemaining: 600 },
  { id: "star", name: "Star", timeRemaining: 600, priority: true },
  { id: "bottom", name: "Bottom", timeRemaining: 300 },
];

describe("time allocation", () => {
  it("drains automatic donors bottom-up and never falls back to starred time", () => {
    const preview = calculateAllocation({
      operation: "extra",
      activities,
      vaultSeconds: 0,
      sessionRevision: 3,
      requestedSeconds: 700,
      sourceId: "otherActivities",
      targetId: "top",
    });
    expect(
      preview.changes.map((change) => [
        change.id,
        change.beforeSeconds,
        change.afterSeconds,
      ]),
    ).toEqual([
      ["top", 600, 900],
      ["bottom", 300, 0],
    ]);
    expect(preview.unfundedSeconds).toBe(400);
    expect(preview.changes.some((change) => change.id === "star")).toBe(false);
  });

  it("supports each explicit transfer direction with exact before and after values", () => {
    const toVault = calculateAllocation({
      operation: "transfer",
      activities,
      vaultSeconds: 10,
      sessionRevision: 1,
      requestedSeconds: 60,
      sourceId: "bottom",
      targetId: "vault",
    });
    expect(toVault.vaultAfterSeconds).toBe(70);
    expect(
      toVault.changes.find((change) => change.id === "bottom")?.afterSeconds,
    ).toBe(240);
    const fromVault = calculateAllocation({
      operation: "transfer",
      activities,
      vaultSeconds: 70,
      sessionRevision: 1,
      requestedSeconds: 60,
      sourceId: "vault",
      targetId: "top",
    });
    expect(fromVault.vaultAfterSeconds).toBe(10);
    expect(
      fromVault.changes.find((change) => change.id === "top")?.afterSeconds,
    ).toBe(660);
  });

  it("requires an explicit override for a protected manual donor", () => {
    const blocked = calculateAllocation({
      operation: "transfer",
      activities,
      vaultSeconds: 0,
      sessionRevision: 1,
      requestedSeconds: 60,
      sourceId: "star",
      targetId: "top",
    });
    expect(blocked.valid).toBe(false);
    expect(blocked.protectedOverrideRequired).toBe(true);
    expect(
      calculateAllocation({ ...blocked.request, allowProtectedManual: true })
        .valid,
    ).toBe(true);
  });

  it("rebases ordinary timer drift against the latest remaining values", () => {
    const preview = calculateAllocation({
      operation: "transfer",
      activities,
      vaultSeconds: 10,
      sessionRevision: 1,
      requestedSeconds: 60,
      sourceId: "bottom",
      targetId: "top",
    });
    const result = confirmAllocation(preview, {
      activities: activities.map((activity) =>
        activity.id === "bottom"
          ? { ...activity, timeRemaining: 200 }
          : activity,
      ),
      vaultSeconds: 10,
      sessionRevision: 2,
    });
    expect(result.committed).toBe(true);
    expect(
      result.preview.activities.find((activity) => activity.id === "bottom")
        ?.timeRemaining,
    ).toBe(140);
  });

  it("rejects a structural change while the preview is open", () => {
    const preview = calculateAllocation({
      operation: "transfer",
      activities,
      vaultSeconds: 10,
      sessionRevision: 1,
      requestedSeconds: 60,
      sourceId: "bottom",
      targetId: "top",
    });
    const result = confirmAllocation(preview, {
      activities: activities.slice(0, 2),
      vaultSeconds: 10,
      sessionRevision: 2,
    });
    expect(result.committed).toBe(false);
    expect(result.reason).toBe("stale");
  });

  it("reactivates a completed countdown target without starting it", () => {
    const completed: AllocationActivity = {
      id: "done",
      name: "Done",
      timeRemaining: 0,
      isCompleted: true,
      completedElapsedSeconds: 120,
      status: "completed",
    };
    const preview = calculateAllocation({
      operation: "transfer",
      activities: [completed],
      vaultSeconds: 120,
      sessionRevision: 1,
      requestedSeconds: 60,
      sourceId: "vault",
      targetId: "done",
    });
    expect(preview.valid).toBe(true);
    expect(preview.vaultAfterSeconds).toBe(60);
    expect(preview.activities[0]).toMatchObject({
      timeRemaining: 60,
      isCompleted: false,
      status: "scheduled",
    });
    expect(preview.activities[0].completedElapsedSeconds).toBeUndefined();
  });

  it("conserves countdown plus Vault time and normalizes percentages", () => {
    const beforeTotal =
      activities.reduce((sum, activity) => sum + activity.timeRemaining, 0) +
      10;
    const preview = calculateAllocation({
      operation: "transfer",
      activities,
      vaultSeconds: 10,
      sessionRevision: 1,
      requestedSeconds: 75,
      sourceId: "bottom",
      targetId: "vault",
    });
    const afterTotal =
      preview.activities.reduce(
        (sum, activity) => sum + activity.timeRemaining,
        0,
      ) + preview.vaultAfterSeconds;
    expect(afterTotal).toBe(beforeTotal);
    expect(
      preview.activities.reduce(
        (sum, activity) => sum + (activity.percentage || 0),
        0,
      ),
    ).toBeCloseTo(100);
  });

  it("preserves the setup-time minimum and reports an unfunded remainder", () => {
    const preview = calculateAllocation({
      operation: "extra",
      activities: [
        { id: "target", name: "Target", timeRemaining: 60 },
        { id: "donor", name: "Donor", timeRemaining: 100 },
      ],
      vaultSeconds: 0,
      sessionRevision: 1,
      requestedSeconds: 80,
      sourceId: "otherActivities",
      targetId: "target",
      minimumDonorSeconds: 60,
    });
    expect(preview.appliedSeconds).toBe(40);
    expect(preview.unfundedSeconds).toBe(40);
  });
});
