import { describe, expect, it } from "vitest";
import {
  createTimer,
  checkpointTimer,
  elapsedAt,
  pauseTimer,
  reconcileTimer,
  snapshotTimer,
  startTimer,
} from "./timer";

describe("timestamp timer", () => {
  it("derives elapsed time without mutating persisted state every second", () => {
    const running = startTimer(createTimer("session", 1_000), 1_000);
    expect(elapsedAt(running, 6_250)).toBe(5_250);
    expect(running.accumulatedMs).toBe(0);
    expect(running.revision).toBe(1);
  });

  it("does not credit the same background period twice", () => {
    const running = startTimer(createTimer("flow", 1_000, 5_000), 1_000);
    const first = reconcileTimer(running, 7_000);
    const second = reconcileTimer(first, 7_000);
    expect(first.status).toBe("completed");
    expect(first.accumulatedMs).toBe(6_000);
    expect(second.accumulatedMs).toBe(6_000);
  });

  it("clamps a backward device-clock change", () => {
    const running = startTimer(createTimer("single", 10_000), 10_000);
    const paused = pauseTimer(running, 15_000);
    expect(elapsedAt(paused, 1_000)).toBe(5_000);
    expect(snapshotTimer(paused, 1_000).observedAtMs).toBe(15_000);
  });

  it("checkpoints a running timer without changing its derived elapsed time", () => {
    const running = startTimer(createTimer("session", 1_000), 1_000);
    const checkpoint = checkpointTimer(running, 4_000);
    expect(elapsedAt(checkpoint, 4_000)).toBe(3_000);
    expect(elapsedAt(checkpoint, 7_000)).toBe(6_000);
  });
});
