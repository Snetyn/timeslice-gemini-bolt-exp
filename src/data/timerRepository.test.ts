import { beforeEach, describe, expect, it } from "vitest";
import { createTimer, pauseTimer, startTimer } from "../domain/timer";
import {
  RevisionConflictError,
  reconcilePersistedTimer,
  saveTimer,
} from "./timerRepository";
import { timeSliceDb } from "./timesliceDb";

describe("timer repository", () => {
  beforeEach(async () => {
    timeSliceDb.close();
    await timeSliceDb.delete();
    await timeSliceDb.open();
  });

  it("detects a stale multi-window timer mutation", async () => {
    const initial = createTimer("session", 1_000);
    const running = startTimer(initial, 1_000);
    await saveTimer(running, initial.revision, "start");

    const firstPause = pauseTimer(running, 2_000);
    await saveTimer(firstPause, running.revision, "first-pause");
    const stalePause = pauseTimer(running, 3_000);
    await expect(
      saveTimer(stalePause, running.revision, "stale-pause"),
    ).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it("does not write a running count-up timer during ordinary reconciliation", async () => {
    const initial = createTimer("single", 1_000);
    const running = startTimer(initial, 1_000);
    await saveTimer(running, initial.revision);
    const result = await reconcilePersistedTimer("single", 20_000);
    expect(result?.revision).toBe(running.revision);
    expect((await timeSliceDb.timers.get("single"))?.value.updatedAtMs).toBe(
      running.updatedAtMs,
    );
  });
});
