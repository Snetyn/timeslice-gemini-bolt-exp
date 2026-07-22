import { beforeEach, describe, expect, it } from "vitest";
import { createTimer, pauseTimer, startTimer } from "../domain/timer";
import {
  checkpointPersistedTimers,
  MutationIdConflictError,
  RevisionConflictError,
  reconcilePersistedTimer,
  saveTimer,
  transitionTimer,
} from "./timerRepository";
import { readWorkspaceRevision, timeSliceDb } from "./timesliceDb";

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

  it("persists semantic commands while preserving elapsed timestamps", async () => {
    await transitionTimer("daily:focus", "start", { nowMs: 1_000 });
    const paused = await transitionTimer("daily:focus", "pause", {
      nowMs: 6_000,
    });
    expect(paused.status).toBe("paused");
    expect(paused.accumulatedMs).toBe(5_000);
  });

  it("replays one mutation without changing timer or workspace revisions", async () => {
    const options = { nowMs: 1_000, mutationId: "stable-start" };
    const first = await transitionTimer("session", "start", options);
    const workspaceRevision = await readWorkspaceRevision();
    const replay = await transitionTimer("session", "start", options);

    expect(replay).toEqual(first);
    expect((await timeSliceDb.timers.get("session"))?.value).toEqual(first);
    expect(await readWorkspaceRevision()).toBe(workspaceRevision);
  });

  it("rejects reuse of a mutation ID for another command", async () => {
    await transitionTimer("session", "start", {
      nowMs: 1_000,
      mutationId: "reused-command",
    });
    await expect(
      transitionTimer("session", "pause", {
        nowMs: 2_000,
        mutationId: "reused-command",
      }),
    ).rejects.toBeInstanceOf(MutationIdConflictError);
  });

  it("does not checkpoint the same running timestamp twice", async () => {
    await transitionTimer("session", "start", {
      nowMs: 1_000,
      mutationId: "checkpoint-start",
    });
    await checkpointPersistedTimers(4_000);
    const timerRevision = (await timeSliceDb.timers.get("session"))?.value
      .revision;
    const workspaceRevision = await readWorkspaceRevision();

    await checkpointPersistedTimers(4_000);
    expect((await timeSliceDb.timers.get("session"))?.value.revision).toBe(
      timerRevision,
    );
    expect(await readWorkspaceRevision()).toBe(workspaceRevision);
  });
});
