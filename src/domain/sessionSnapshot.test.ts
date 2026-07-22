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
});
