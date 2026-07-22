import { describe, expect, it } from "vitest";
import {
  elapsedSecondsAt,
  pauseAnchoredElapsed,
  resumeAnchoredElapsed,
} from "./modeTime";

describe("anchored mode elapsed time", () => {
  it("derives Daily and Single time from a timestamp", () => {
    expect(
      elapsedSecondsAt(
        { accumulatedSeconds: 60, startedAt: 1_000, running: true },
        6_500,
      ),
    ).toBe(65);
  });

  it("pauses and resumes without counting the paused gap", () => {
    const paused = pauseAnchoredElapsed(
      { accumulatedSeconds: 5, startedAt: 1_000, running: true },
      4_000,
    );
    expect(elapsedSecondsAt(paused, 50_000)).toBe(8);
    const resumed = resumeAnchoredElapsed(paused, 60_000);
    expect(elapsedSecondsAt(resumed, 62_500)).toBe(10);
  });

  it("does not become negative when the device clock moves backwards", () => {
    expect(
      elapsedSecondsAt(
        { accumulatedSeconds: 7, startedAt: 10_000, running: true },
        1_000,
      ),
    ).toBe(7);
  });
});
