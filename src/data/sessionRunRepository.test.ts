import { beforeEach, describe, expect, it } from "vitest";
import { createSessionRunSnapshot } from "../domain/sessionSnapshot";
import {
  deleteSessionRun,
  getSessionRun,
  saveSessionRun,
} from "./sessionRunRepository";
import { timeSliceDb } from "./timesliceDb";

describe("Session run repository", () => {
  beforeEach(async () => {
    timeSliceDb.close();
    await timeSliceDb.delete();
    await timeSliceDb.open();
  });

  it("stores activity projection and timestamp anchor in one record", async () => {
    const snapshot = createSessionRunSnapshot({
      status: "running",
      currentActivityIndex: 0,
      lastReconciledAtMs: 5_000,
      sessionPlanFrozen: true,
      initialAllocatedSeconds: 60,
    });
    await saveSessionRun({
      snapshot,
      activities: [{ id: "focus", timeRemaining: 55 }],
      vaultSeconds: 3,
    });
    expect(await getSessionRun()).toEqual({
      snapshot,
      activities: [{ id: "focus", timeRemaining: 55 }],
      vaultSeconds: 3,
    });
  });

  it("removes a completed or exited run without touching other tables", async () => {
    await saveSessionRun({
      snapshot: createSessionRunSnapshot({
        status: "paused",
        currentActivityIndex: 0,
        sessionPlanFrozen: true,
      }),
      activities: [],
      vaultSeconds: 0,
    });
    await deleteSessionRun();
    expect(await getSessionRun()).toBeUndefined();
  });
});
