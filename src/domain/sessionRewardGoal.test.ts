import { describe, expect, it } from "vitest";
import {
  applySessionRewardSlices,
  createSessionRewardContract,
  normalizeSessionRewardContract,
  sessionRewardAvailableSeconds,
  sessionRewardFeasibility,
} from "./sessionRewardGoal";

type Activity = {
  id: string;
  name: string;
  duration: number;
  timeRemaining: number;
  priority?: boolean;
  countUp?: boolean;
  isCompleted?: boolean;
  isRewardRest?: boolean;
  originalPlannedSeconds?: number;
};

const activities = (): Activity[] => [
  { id: "work", name: "Work", duration: 105, timeRemaining: 6_300 },
  { id: "home", name: "Home", duration: 105, timeRemaining: 6_300 },
];

const createRest = (): Activity => ({
  id: "timeslice-banked-rest",
  name: "Reward Rest",
  duration: 0,
  timeRemaining: 0,
  isRewardRest: true,
});

describe("Session Reward Goal", () => {
  it("derives the 210 minute / 60 minute contract exactly", () => {
    const result = createSessionRewardContract({
      activities: activities(),
      sessionTotalSeconds: 210 * 60,
      targetSeconds: 60 * 60,
      mode: "reserved",
      createRestActivity: createRest,
    });
    expect(result.contract?.plannedWorkSeconds).toBe(150 * 60);
    expect(
      result.activities.slice(0, 2).map((item) => item.timeRemaining),
    ).toEqual([4_500, 4_500]);
    expect(result.activities.at(-1)?.timeRemaining).toBe(0);
    expect(
      result.activities.reduce(
        (sum, item) =>
          sum + (item.originalPlannedSeconds ?? item.timeRemaining),
        0,
      ),
    ).toBe(210 * 60);
  });

  it("earns reward from countdown slices with exact fractional carry", () => {
    const created = createSessionRewardContract({
      activities: activities(),
      sessionTotalSeconds: 210 * 60,
      targetSeconds: 60 * 60,
      mode: "reserved",
      createRestActivity: createRest,
    });
    const first = applySessionRewardSlices({
      activities: created.activities,
      contract: created.contract!,
      slices: [
        {
          activityId: "work",
          offsetSeconds: 0,
          durationSeconds: 149,
          kind: "countdown",
        },
      ],
    });
    expect(first.newlyEarnedSeconds).toBe(59);
    const second = applySessionRewardSlices({
      activities: first.activities,
      contract: first.contract,
      slices: [
        {
          activityId: "work",
          offsetSeconds: 0,
          durationSeconds: 1,
          kind: "countdown",
        },
      ],
    });
    expect(second.contract.earnedSeconds).toBe(60);
    expect(sessionRewardAvailableSeconds(second.contract)).toBe(60);
  });

  it("excludes count-up, overtime, and Reward Rest slices", () => {
    const created = createSessionRewardContract({
      activities: activities(),
      sessionTotalSeconds: 210 * 60,
      targetSeconds: 60 * 60,
      mode: "reserved",
      createRestActivity: createRest,
    });
    const result = applySessionRewardSlices({
      activities: created.activities,
      contract: created.contract!,
      slices: [
        {
          activityId: "work",
          offsetSeconds: 0,
          durationSeconds: 20,
          kind: "overtime",
        },
        {
          activityId: "timeslice-banked-rest",
          offsetSeconds: 20,
          durationSeconds: 20,
          kind: "countdown",
        },
      ],
    });
    expect(result.contract.earnedSeconds).toBe(0);
  });

  it("funds live reward proportionally without changing the remaining total", () => {
    const created = createSessionRewardContract({
      activities: activities(),
      sessionTotalSeconds: 210 * 60,
      targetSeconds: 60 * 60,
      mode: "live",
      createRestActivity: createRest,
    });
    const before = created.activities.reduce(
      (sum, item) => sum + item.timeRemaining,
      0,
    );
    const result = applySessionRewardSlices({
      activities: created.activities,
      contract: created.contract!,
      slices: [
        {
          activityId: "work",
          offsetSeconds: 0,
          durationSeconds: 150,
          kind: "countdown",
        },
      ],
    });
    expect(result.newlyEarnedSeconds).toBe(60);
    expect(
      result.activities.find((item) => item.isRewardRest)?.timeRemaining,
    ).toBe(60);
    expect(
      result.activities.reduce((sum, item) => sum + item.timeRemaining, 0),
    ).toBe(before);
  });

  it("protects starred donors and offers a fitted goal", () => {
    const source = activities();
    source[0].priority = true;
    expect(sessionRewardFeasibility(source, 210 * 60, 120 * 60)).toMatchObject({
      feasible: false,
      fittedSeconds: 105 * 60,
    });
  });

  it("rejects malformed persisted contracts", () => {
    expect(
      normalizeSessionRewardContract({ targetSeconds: 0 }),
    ).toBeUndefined();
    expect(
      normalizeSessionRewardContract({
        targetSeconds: 60,
        sessionTotalSeconds: 120,
        mode: "unknown",
        earnedSeconds: "bad",
      }),
    ).toMatchObject({ mode: "reserved", earnedSeconds: 0 });
  });
});
