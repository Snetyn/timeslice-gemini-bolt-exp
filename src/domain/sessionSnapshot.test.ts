import { describe, expect, it } from "vitest";
import {
  createSessionRunSnapshot,
  normalizePersistedSessionRun,
  normalizeSessionRunSnapshot,
} from "./sessionSnapshot";

describe("persisted Session run snapshot", () => {
  it("retains rollback-compatible fields", () => {
    expect(
      createSessionRunSnapshot({
        status: "running",
        currentActivityIndex: 2,
        lastReconciledAtMs: 5_000,
        sessionPlanFrozen: true,
        initialAllocatedSeconds: 600,
      }),
    ).toMatchObject({
      version: 1,
      isTimerActive: true,
      isPaused: false,
      lastActiveTimestamp: 5_000,
      lastReconciledAtMs: 5_000,
    });
  });

  it("normalizes legacy checkpoints and invalid numbers", () => {
    expect(
      normalizeSessionRunSnapshot({
        isTimerActive: true,
        isPaused: true,
        currentActivityIndex: -4,
        lastActiveTimestamp: "bad",
      }),
    ).toMatchObject({
      status: "paused",
      currentActivityIndex: 0,
      lastReconciledAtMs: null,
    });
  });

  it("rejects non-object values", () => {
    expect(normalizeSessionRunSnapshot("broken")).toBeNull();
  });

  it("keeps valid Session activities while removing corrupt entries", () => {
    expect(
      normalizePersistedSessionRun({
        snapshot: createSessionRunSnapshot({
          status: "running",
          currentActivityIndex: 0,
          sessionPlanFrozen: true,
          lastReconciledAtMs: 1_000,
        }),
        activities: [
          undefined,
          { id: "missing-name" },
          {
            id: "focus",
            name: " Focus ",
            color: "",
            duration: 2,
            timeRemaining: Number.NaN,
          },
        ],
        vaultSeconds: Number.POSITIVE_INFINITY,
      }),
    ).toMatchObject({
      activities: [
        {
          id: "focus",
          name: "Focus",
          color: "#64748b",
          duration: 2,
          timeRemaining: 120,
        },
      ],
      vaultSeconds: 0,
    });
  });

  it("normalizes two-tier Flowmodoro fields without rejecting old snapshots", () => {
    const normalized = normalizePersistedSessionRun({
      snapshot: createSessionRunSnapshot({
        status: "paused",
        currentActivityIndex: 0,
        sessionPlanFrozen: false,
      }),
      activities: [],
      vaultSeconds: 0,
      flowmodoroState: {
        availableRestTime: 30,
        relaxationVaultSeconds: "120",
        totalEarnedToday: 150,
        cycleCount: 0,
        isOnBreak: true,
        breakTimeRemaining: 60,
        initialBreakDuration: 90,
        lastResetDate: new Date().toDateString(),
        accumulatedFractionalTime: 1,
        relaxationVaultPeriodKey: "week:2026-07-27",
        activeBreakFunding: {
          reserveSeconds: "bad",
          vaultSeconds: 60,
          vaultPeriodKey: "week:2026-07-27",
        },
        activeBreakBehavior: "postpone",
      },
    });
    expect(normalized?.flowmodoroState).toMatchObject({
      availableRestTime: 30,
      relaxationVaultSeconds: 120,
      activeBreakFunding: {
        reserveSeconds: 0,
        vaultSeconds: 60,
      },
      activeBreakBehavior: "postpone",
    });
  });

  it("validates Reward Rest donor metadata without rewriting other fields", () => {
    const normalized = normalizePersistedSessionRun({
      snapshot: createSessionRunSnapshot({
        status: "paused",
        currentActivityIndex: 0,
        sessionPlanFrozen: true,
      }),
      activities: [
        {
          id: "timeslice-banked-rest",
          name: "Reward Rest",
          color: "#8b5cf6",
          duration: 1,
          timeRemaining: 60,
          isRewardRest: true,
          rollbackField: "kept",
          rewardRestFunding: {
            donatedSecondsById: { focus: 40.9, bad: "nope" },
            fundedSeconds: 60,
          },
        },
      ],
      vaultSeconds: 0,
    });
    expect(normalized?.activities[0]).toMatchObject({
      rollbackField: "kept",
      rewardRestFunding: {
        donatedSecondsById: { focus: 40 },
        fundedSeconds: 60,
        operations: [{ donatedSecondsById: { focus: 40 }, fundedSeconds: 60 }],
      },
    });
  });

  it("validates child metadata and promotes orphaned or nested records", () => {
    const normalized = normalizePersistedSessionRun({
      snapshot: createSessionRunSnapshot({
        status: "paused",
        currentActivityIndex: 0,
        sessionPlanFrozen: true,
      }),
      activities: [
        { id: "parent", name: "Parent", color: "#123", duration: 10 },
        {
          id: "child",
          name: "Child",
          color: "#456",
          duration: 2,
          parentActivityId: "parent",
          subActivityFunding: {
            fundedSeconds: 120.9,
            donatedSecondsById: { donor: 120.9, invalid: "bad" },
          },
        },
        {
          id: "nested",
          name: "Nested",
          color: "#789",
          duration: 1,
          parentActivityId: "child",
        },
        {
          id: "orphan",
          name: "Orphan",
          color: "#aaa",
          duration: 1,
          parentActivityId: "missing",
        },
      ],
      vaultSeconds: 0,
    });
    expect(normalized?.activities.map((activity) => activity.id)).toEqual([
      "parent",
      "child",
      "nested",
      "orphan",
    ]);
    expect(normalized?.activities[1]).toMatchObject({
      parentActivityId: "parent",
      subActivityFunding: {
        fundedSeconds: 120,
        donatedSecondsById: { donor: 120 },
      },
    });
    expect(normalized?.activities[2].parentActivityId).toBeUndefined();
    expect(normalized?.activities[3].parentActivityId).toBeUndefined();
  });

  it("preserves and normalizes an active Session Reward contract", () => {
    const snapshot = createSessionRunSnapshot({
      status: "running",
      currentActivityIndex: 0,
      lastReconciledAtMs: 10_000,
      sessionPlanFrozen: true,
      sessionRewardContract: {
        version: 1,
        mode: "live",
        status: "active",
        targetSeconds: 3_600,
        sessionTotalSeconds: 12_600,
        plannedWorkSeconds: 9_000,
        eligibleFocusedSeconds: 150,
        earnedSeconds: 60,
        consumedSeconds: 10,
        bankedSeconds: 0,
        discardedSeconds: 0,
        donatedSecondsById: { focus: 60 },
        visualPlannedSecondsById: {
          focus: 9_000,
          "timeslice-banked-rest": 3_600,
        },
        operations: [
          { fundedSeconds: 60, donatedSecondsById: { focus: 60 } },
        ],
      },
    });
    expect(snapshot.sessionRewardContract).toMatchObject({
      mode: "live",
      earnedSeconds: 60,
      visualPlannedSecondsById: { focus: 9_000 },
    });
    expect(
      normalizeSessionRunSnapshot({
        ...snapshot,
        sessionRewardContract: {
          ...snapshot.sessionRewardContract,
          earnedSeconds: Number.NaN,
        },
      })?.sessionRewardContract?.earnedSeconds,
    ).toBe(0);
  });
});
