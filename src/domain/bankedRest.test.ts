import { describe, expect, it } from "vitest";
import {
  allocateBankedRest,
  BANKED_REST_ACTIVITY_ID,
  rewardEligibleSessionSeconds,
  type BankedRestActivity,
} from "./bankedRest";

type Activity = BankedRestActivity & { name: string };

const rest = (): Activity => ({
  id: BANKED_REST_ACTIVITY_ID,
  name: "Reward Rest",
  isRewardRest: true,
  priority: true,
});

describe("rewardEligibleSessionSeconds", () => {
  it("excludes Rest slices when one batch crosses work and rest", () => {
    expect(
      rewardEligibleSessionSeconds(
        [{ id: "work" }, { id: BANKED_REST_ACTIVITY_ID, isRewardRest: true }],
        [
          { activityId: "work", durationSeconds: 45 },
          { activityId: BANKED_REST_ACTIVITY_ID, durationSeconds: 30 },
          { activityId: "work", durationSeconds: 15 },
        ],
      ),
    ).toBe(60);
  });
});

describe("allocateBankedRest", () => {
  it("funds Rest proportionally while preserving the session total", () => {
    const result = allocateBankedRest<Activity>({
      activities: [
        { id: "a", name: "A", percentage: 75 },
        { id: "b", name: "B", percentage: 25 },
      ],
      totalSessionSeconds: 400,
      requestedSeconds: 100,
      bankedSeconds: 180,
      createRestActivity: rest,
    });

    expect(result.allocatedSeconds).toBe(100);
    expect(result.remainingBankedSeconds).toBe(80);
    expect(result.donatedSecondsById).toEqual({ a: 75, b: 25 });
    expect(
      result.activities.reduce(
        (sum, activity) => sum + Number(activity.timeRemaining || 0),
        0,
      ),
    ).toBe(400);
    expect(
      result.activities.find((activity) => activity.isRewardRest)
        ?.timeRemaining,
    ).toBe(100);
  });

  it("protects starred, completed, and count-up tasks", () => {
    const result = allocateBankedRest<Activity>({
      activities: [
        { id: "star", name: "Star", percentage: 25, priority: true },
        { id: "done", name: "Done", percentage: 25, isCompleted: true },
        { id: "up", name: "Up", countUp: true, percentage: 0 },
        { id: "donor", name: "Donor", percentage: 50, isLocked: true },
      ],
      totalSessionSeconds: 400,
      requestedSeconds: 300,
      bankedSeconds: 300,
      createRestActivity: rest,
    });

    expect(result.allocatedSeconds).toBe(200);
    expect(result.remainingBankedSeconds).toBe(100);
    expect(result.donatedSecondsById).toEqual({ donor: 200 });
  });

  it("adds to an existing Rest allocation and reactivates it", () => {
    const result = allocateBankedRest<Activity>({
      activities: [
        { id: "a", name: "A", percentage: 80 },
        {
          ...rest(),
          percentage: 20,
          isCompleted: true,
          completedElapsedSeconds: 80,
        },
      ],
      totalSessionSeconds: 500,
      requestedSeconds: 50,
      bankedSeconds: 50,
      createRestActivity: rest,
    });

    const fundedRest = result.activities.find(
      (activity) => activity.isRewardRest,
    );
    expect(fundedRest?.timeRemaining).toBe(150);
    expect(fundedRest?.isCompleted).toBe(false);
    expect(fundedRest?.completedElapsedSeconds).toBe(0);
    expect(result.activities).toHaveLength(2);
  });

  it("does nothing when no eligible donor time exists", () => {
    const activities: Activity[] = [
      { id: "star", name: "Star", percentage: 100, priority: true },
    ];
    const result = allocateBankedRest<Activity>({
      activities,
      totalSessionSeconds: 60,
      requestedSeconds: 60,
      bankedSeconds: 60,
      createRestActivity: rest,
    });
    expect(result.activities).toBe(activities);
    expect(result.allocatedSeconds).toBe(0);
    expect(result.remainingBankedSeconds).toBe(60);
  });
});
