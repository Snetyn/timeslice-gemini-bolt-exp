import { describe, expect, it } from "vitest";
import {
  allocateBankedRest,
  BANKED_REST_ACTIVITY_ID,
  normalizeRewardRestFunding,
  restoreBankedRest,
  rewardBankHoldings,
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
    expect(
      result.activities.find((activity) => activity.isRewardRest)
        ?.rewardRestFunding,
    ).toEqual({
      donatedSecondsById: { a: 75, b: 25 },
      fundedSeconds: 100,
      operations: [
        {
          donatedSecondsById: { a: 75, b: 25 },
          fundedSeconds: 100,
        },
      ],
    });
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

  it("retains an ordered donor map for each funding operation", () => {
    const first = allocateBankedRest<Activity>({
      activities: [
        { id: "a", name: "A", timeRemaining: 300 },
        { id: "b", name: "B", timeRemaining: 100 },
      ],
      totalSessionSeconds: 400,
      requestedSeconds: 40,
      bankedSeconds: 100,
      createRestActivity: rest,
    });
    const second = allocateBankedRest<Activity>({
      activities: first.activities,
      totalSessionSeconds: 400,
      requestedSeconds: 20,
      bankedSeconds: first.remainingBankedSeconds,
      createRestActivity: rest,
    });
    const funding = second.activities.find(
      (activity) => activity.isRewardRest,
    )?.rewardRestFunding;
    expect(funding?.operations).toHaveLength(2);
    expect(
      funding?.operations.map((operation) => operation.fundedSeconds),
    ).toEqual([40, 20]);
    expect(funding?.fundedSeconds).toBe(60);
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

  it("caps Reward Rest at one goal allocation and leaves excess available", () => {
    const result = allocateBankedRest<Activity>({
      activities: [
        { id: "a", name: "A", percentage: 90 },
        { ...rest(), percentage: 10, timeRemaining: 60 },
      ],
      totalSessionSeconds: 600,
      requestedSeconds: 300,
      bankedSeconds: 300,
      maxRewardRestSeconds: 120,
      createRestActivity: rest,
    });
    expect(result.allocatedSeconds).toBe(60);
    expect(result.remainingBankedSeconds).toBe(240);
    expect(
      result.activities.find((activity) => activity.isRewardRest)
        ?.timeRemaining,
    ).toBe(120);
  });

  it("restores partially consumed Rest to original donors exactly", () => {
    const result = restoreBankedRest<Activity>({
      activities: [
        { id: "a", name: "A", timeRemaining: 300 },
        { id: "b", name: "B", timeRemaining: 100 },
        {
          ...rest(),
          timeRemaining: 60,
          rewardRestFunding: {
            donatedSecondsById: { a: 75, b: 25 },
            fundedSeconds: 100,
            operations: [
              {
                donatedSecondsById: { a: 75, b: 25 },
                fundedSeconds: 100,
              },
            ],
          },
        },
      ],
      totalSessionSeconds: 460,
      sessionVaultSeconds: 10,
    });
    expect(
      result.activities.find((activity) => activity.id === "a")?.timeRemaining,
    ).toBe(345);
    expect(
      result.activities.find((activity) => activity.id === "b")?.timeRemaining,
    ).toBe(115);
    expect(result.activities.some((activity) => activity.isRewardRest)).toBe(
      false,
    );
    expect(result.restoredSeconds).toBe(60);
    expect(result.sessionVaultSeconds).toBe(10);
  });

  it("redistributes missing donor shares and falls back to Session Time Vault", () => {
    const redistributed = restoreBankedRest<Activity>({
      activities: [
        { id: "a", name: "A", timeRemaining: 100 },
        {
          ...rest(),
          timeRemaining: 60,
          rewardRestFunding: {
            donatedSecondsById: { deleted: 60 },
            fundedSeconds: 60,
            operations: [
              {
                donatedSecondsById: { deleted: 60 },
                fundedSeconds: 60,
              },
            ],
          },
        },
      ],
      totalSessionSeconds: 160,
    });
    expect(redistributed.activities[0].timeRemaining).toBe(160);
    expect(redistributed.sessionVaultSeconds).toBe(0);

    const fallback = restoreBankedRest<Activity>({
      activities: [
        { id: "done", name: "Done", timeRemaining: 0, isCompleted: true },
        { ...rest(), timeRemaining: 60 },
      ],
      totalSessionSeconds: 60,
      sessionVaultSeconds: 5,
    });
    expect(fallback.sessionVaultSeconds).toBe(65);
  });

  it("normalizes malformed funding and reports one shared Bank holding", () => {
    expect(
      normalizeRewardRestFunding({
        donatedSecondsById: { a: 30.9, b: -4, "": 10, c: "bad" },
        fundedSeconds: 35,
      }),
    ).toEqual({
      donatedSecondsById: { a: 30 },
      fundedSeconds: 35,
      operations: [{ donatedSecondsById: { a: 30 }, fundedSeconds: 35 }],
    });
    expect(rewardBankHoldings(90, [{ ...rest(), timeRemaining: 30 }])).toEqual({
      availableSeconds: 90,
      scheduledSeconds: 30,
      totalSeconds: 120,
    });
  });
});
