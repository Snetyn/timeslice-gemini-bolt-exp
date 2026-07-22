import { describe, expect, it } from "vitest";
import { advanceClock, createClockAnchor } from "./clock";

describe("monotonic wall-clock batches", () => {
  it("preserves sub-second remainder without interval drift", () => {
    const first = advanceClock(createClockAnchor(1_000), 1_650);
    expect(first.elapsedSeconds).toBe(0);
    expect(first.anchor.remainderMs).toBe(650);

    const second = advanceClock(first.anchor, 2_100);
    expect(second.elapsedSeconds).toBe(1);
    expect(second.anchor.remainderMs).toBe(100);
  });

  it("is idempotent when lifecycle events sample the same instant", () => {
    const first = advanceClock(createClockAnchor(1_000), 6_000);
    const second = advanceClock(first.anchor, 6_000);
    expect(first.elapsedSeconds).toBe(5);
    expect(second.elapsedSeconds).toBe(0);
  });

  it("clamps device-clock rollback and resumes from the last observed time", () => {
    const backward = advanceClock(createClockAnchor(10_000), 2_000);
    expect(backward.elapsedSeconds).toBe(0);
    expect(backward.anchor.observedAtMs).toBe(10_000);

    const resumed = advanceClock(backward.anchor, 12_500);
    expect(resumed.elapsedSeconds).toBe(2);
    expect(resumed.anchor.remainderMs).toBe(500);
  });

  it("processes long background periods once as one deterministic batch", () => {
    const first = advanceClock(createClockAnchor(0), 30 * 60 * 1_000);
    const duplicate = advanceClock(first.anchor, 30 * 60 * 1_000);
    expect(first.elapsedSeconds).toBe(1_800);
    expect(duplicate.elapsedSeconds).toBe(0);
  });
});
