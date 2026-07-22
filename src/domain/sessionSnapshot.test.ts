import { describe, expect, it } from "vitest";
import {
  createSessionRunSnapshot,
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
});
