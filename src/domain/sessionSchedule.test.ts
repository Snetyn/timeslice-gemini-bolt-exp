import { describe, expect, it } from "vitest";
import {
  predictedEndAtMs,
  predictedScheduleSeconds,
  remainingCountdownSeconds,
} from "./sessionSchedule";

describe("current Session schedule semantics", () => {
  const activities = [
    { id: "focus", timeRemaining: 600 },
    { id: "done", timeRemaining: 300, isCompleted: true },
    { id: "count-up", timeRemaining: 900, countUp: true },
    { id: "overtime", timeRemaining: -120 },
  ];

  it("counts only positive unfinished countdown time", () => {
    expect(remainingCountdownSeconds(activities)).toBe(600);
  });

  it("keeps Vault outside the existing linked prediction", () => {
    expect(predictedScheduleSeconds(activities, 300, "linked")).toBe(600);
    expect(predictedEndAtMs(activities, 1_000, 300, "linked")).toBe(601_000);
  });

  it("supports the later schedule-preserving independent formula", () => {
    expect(predictedScheduleSeconds(activities, 300, "independent")).toBe(
      900,
    );
  });
});
