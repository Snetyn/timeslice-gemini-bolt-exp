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
      activities: [
        {
          id: "focus",
          name: "Focus",
          color: "#2563eb",
          duration: 1,
          timeRemaining: 55,
        },
      ],
      vaultSeconds: 3,
    });
    expect(await getSessionRun()).toEqual({
      snapshot,
      activities: [
        expect.objectContaining({
          id: "focus",
          name: "Focus",
          duration: 1,
          timeRemaining: 55,
        }),
      ],
      vaultSeconds: 3,
    });
  });

  it("filters invalid activities and normalizes unsafe timer values", async () => {
    const snapshot = createSessionRunSnapshot({
      status: "paused",
      currentActivityIndex: 0,
      sessionPlanFrozen: true,
    });
    await saveSessionRun({
      snapshot,
      activities: [
        null,
        { id: "", name: "Blank", duration: 1 },
        {
          id: "safe",
          name: "Safe",
          duration: Number.NaN,
          timeRemaining: Number.POSITIVE_INFINITY,
          countUp: true,
          tags: ["one", 2],
        },
      ],
      vaultSeconds: -20,
      flowmodoroState: {
        availableRestTime: Number.NaN,
        breakTimeRemaining: -4,
        isOnBreak: true,
      },
    });

    expect(await getSessionRun()).toMatchObject({
      activities: [
        {
          id: "safe",
          duration: 0,
          timeRemaining: 0,
          tags: ["one"],
        },
      ],
      vaultSeconds: 0,
      flowmodoroState: {
        availableRestTime: 0,
        breakTimeRemaining: 0,
        isOnBreak: false,
      },
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
