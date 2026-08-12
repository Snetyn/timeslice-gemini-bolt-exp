import { BANKED_REST_ACTIVITY_ID } from "./bankedRest";
import type { SessionActivitySlice } from "./sessionRun";

export type SessionRewardMode = "reserved" | "live";
export type SessionRewardContractStatus =
  "active" | "banked" | "completed" | "reset";

export type SessionRewardFundingOperation = {
  fundedSeconds: number;
  donatedSecondsById: Record<string, number>;
};

export type SessionRewardContract = {
  version: 1;
  mode: SessionRewardMode;
  status: SessionRewardContractStatus;
  targetSeconds: number;
  sessionTotalSeconds: number;
  plannedWorkSeconds: number;
  eligibleFocusedSeconds: number;
  earnedSeconds: number;
  consumedSeconds: number;
  bankedSeconds: number;
  discardedSeconds: number;
  donatedSecondsById: Record<string, number>;
  visualPlannedSecondsById: Record<string, number>;
  operations: SessionRewardFundingOperation[];
};

export type SessionRewardActivity = {
  id: string;
  name?: string;
  duration?: number;
  percentage?: number;
  timeRemaining?: number;
  originalPlannedSeconds?: number;
  countUp?: boolean;
  isCompleted?: boolean;
  ownTimerCompleted?: boolean;
  completedElapsedSeconds?: number;
  priority?: boolean;
  isRewardRest?: boolean;
  isSystemActivity?: boolean;
  parentActivityId?: string;
  sessionRewardTargetSeconds?: number;
  manualOnly?: boolean;
};

export type SessionRewardFeasibility = {
  requestedSeconds: number;
  fittedSeconds: number;
  donorCapacitySeconds: number;
  plannedWorkSeconds: number;
  feasible: boolean;
};

const wholeSeconds = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeMap = (value: unknown) =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value)
          .map(([id, seconds]) => [id, wholeSeconds(seconds)] as const)
          .filter(([id, seconds]) => Boolean(id.trim()) && seconds > 0),
      )
    : {};

export function normalizeSessionRewardContract(
  value: unknown,
): SessionRewardContract | undefined {
  if (!isRecord(value)) return undefined;
  const mode: SessionRewardMode = value.mode === "live" ? "live" : "reserved";
  const status: SessionRewardContractStatus =
    value.status === "banked" ||
    value.status === "completed" ||
    value.status === "reset"
      ? value.status
      : "active";
  const targetSeconds = wholeSeconds(value.targetSeconds);
  const sessionTotalSeconds = wholeSeconds(value.sessionTotalSeconds);
  if (!targetSeconds || targetSeconds >= sessionTotalSeconds) return undefined;
  const plannedWorkSeconds = Math.max(
    1,
    Math.min(
      sessionTotalSeconds - targetSeconds,
      wholeSeconds(value.plannedWorkSeconds) ||
        sessionTotalSeconds - targetSeconds,
    ),
  );
  const earnedSeconds = Math.min(
    targetSeconds,
    wholeSeconds(value.earnedSeconds),
  );
  const consumedSeconds = Math.min(
    earnedSeconds,
    wholeSeconds(value.consumedSeconds),
  );
  const bankedSeconds = Math.min(
    earnedSeconds - consumedSeconds,
    wholeSeconds(value.bankedSeconds),
  );
  const operations = Array.isArray(value.operations)
    ? value.operations
        .filter(isRecord)
        .map((operation) => ({
          fundedSeconds: wholeSeconds(operation.fundedSeconds),
          donatedSecondsById: normalizeMap(operation.donatedSecondsById),
        }))
        .filter((operation) => operation.fundedSeconds > 0)
    : [];
  return {
    version: 1,
    mode,
    status,
    targetSeconds,
    sessionTotalSeconds,
    plannedWorkSeconds,
    eligibleFocusedSeconds: wholeSeconds(value.eligibleFocusedSeconds),
    earnedSeconds,
    consumedSeconds,
    bankedSeconds,
    discardedSeconds: wholeSeconds(value.discardedSeconds),
    donatedSecondsById: normalizeMap(value.donatedSecondsById),
    visualPlannedSecondsById: normalizeMap(value.visualPlannedSecondsById),
    operations,
  };
}

export const sessionRewardAvailableSeconds = (
  contract: SessionRewardContract | undefined,
) =>
  contract
    ? Math.max(
        0,
        contract.earnedSeconds -
          contract.consumedSeconds -
          contract.bankedSeconds,
      )
    : 0;

export const sessionRewardLockedSeconds = (
  contract: SessionRewardContract | undefined,
) =>
  contract ? Math.max(0, contract.targetSeconds - contract.earnedSeconds) : 0;

export const isSessionRewardDonor = (
  activity: SessionRewardActivity,
  activities: SessionRewardActivity[],
) => {
  const protectedParent = activity.parentActivityId
    ? activities.find((candidate) => candidate.id === activity.parentActivityId)
        ?.priority
    : false;
  return (
    activity.id !== BANKED_REST_ACTIVITY_ID &&
    !activity.isRewardRest &&
    !activity.isSystemActivity &&
    !activity.countUp &&
    !activity.isCompleted &&
    !activity.priority &&
    !protectedParent &&
    wholeSeconds(activity.timeRemaining) > 0
  );
};

export function sessionRewardFeasibility(
  activities: SessionRewardActivity[],
  sessionTotalSeconds: number,
  requestedSeconds: number,
): SessionRewardFeasibility {
  const total = wholeSeconds(sessionTotalSeconds);
  const requested = wholeSeconds(requestedSeconds);
  const donorCapacitySeconds = activities
    .filter((activity) => isSessionRewardDonor(activity, activities))
    .reduce((sum, activity) => sum + wholeSeconds(activity.timeRemaining), 0);
  const fittedSeconds = Math.min(
    requested,
    donorCapacitySeconds,
    Math.max(0, total - 1),
  );
  return {
    requestedSeconds: requested,
    fittedSeconds,
    donorCapacitySeconds,
    plannedWorkSeconds: Math.max(0, total - fittedSeconds),
    feasible:
      requested > 0 && requested < total && donorCapacitySeconds >= requested,
  };
}

function proportionalTake(
  donors: Array<{ id: string; seconds: number; index: number }>,
  requestedSeconds: number,
) {
  const total = donors.reduce((sum, donor) => sum + donor.seconds, 0);
  const amount = Math.min(total, wholeSeconds(requestedSeconds));
  if (!amount || !total)
    return { amount: 0, byId: {} as Record<string, number> };
  const shares = donors.map((donor) => {
    const exact = (amount * donor.seconds) / total;
    return {
      ...donor,
      amount: Math.min(donor.seconds, Math.floor(exact)),
      remainder: exact - Math.floor(exact),
    };
  });
  let remaining = amount - shares.reduce((sum, share) => sum + share.amount, 0);
  const order = [...shares].sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index,
  );
  while (remaining > 0) {
    let changed = false;
    for (const share of order) {
      if (remaining <= 0) break;
      if (share.amount >= share.seconds) continue;
      share.amount += 1;
      remaining -= 1;
      changed = true;
    }
    if (!changed) break;
  }
  return {
    amount,
    byId: Object.fromEntries(shares.map((share) => [share.id, share.amount])),
  };
}

function takeFromActivities<T extends SessionRewardActivity>(
  activities: T[],
  requestedSeconds: number,
) {
  const donors = activities
    .map((activity, index) => ({
      id: activity.id,
      index,
      seconds: wholeSeconds(activity.timeRemaining),
      activity,
    }))
    .filter(({ activity }) => isSessionRewardDonor(activity, activities));
  const transfer = proportionalTake(donors, requestedSeconds);
  return {
    transfer,
    activities: activities.map((activity) => {
      const donated = transfer.byId[activity.id] || 0;
      if (!donated) return activity;
      const remaining = Math.max(
        0,
        wholeSeconds(activity.timeRemaining) - donated,
      );
      return {
        ...activity,
        timeRemaining: remaining,
        duration: remaining / 60,
        originalPlannedSeconds: remaining,
      };
    }),
  };
}

export function createSessionRewardContract<
  T extends SessionRewardActivity,
>(options: {
  activities: T[];
  sessionTotalSeconds: number;
  targetSeconds: number;
  mode: SessionRewardMode;
  createRestActivity: () => T;
}): {
  activities: T[];
  contract?: SessionRewardContract;
  feasibility: SessionRewardFeasibility;
} {
  const feasibility = sessionRewardFeasibility(
    options.activities,
    options.sessionTotalSeconds,
    options.targetSeconds,
  );
  if (!feasibility.feasible)
    return { activities: options.activities, feasibility };

  const targetSeconds = feasibility.requestedSeconds;
  const funded =
    options.mode === "reserved"
      ? takeFromActivities(options.activities, targetSeconds)
      : {
          activities: options.activities,
          transfer: { amount: 0, byId: {} as Record<string, number> },
        };
  let activities = funded.activities;
  const restIndex = activities.findIndex(
    (activity) =>
      activity.id === BANKED_REST_ACTIVITY_ID || activity.isRewardRest,
  );
  const rest =
    restIndex >= 0 ? activities[restIndex] : options.createRestActivity();
  const rewardRest = {
    ...rest,
    id: BANKED_REST_ACTIVITY_ID,
    isRewardRest: true,
    countUp: false,
    priority: true,
    isCompleted: true,
    ownTimerCompleted: false,
    duration: targetSeconds / 60,
    percentage:
      feasibility.requestedSeconds > 0
        ? (targetSeconds / wholeSeconds(options.sessionTotalSeconds)) * 100
        : 0,
    timeRemaining: 0,
    originalPlannedSeconds: targetSeconds,
    sessionRewardTargetSeconds: targetSeconds,
    manualOnly: true,
  } as T;
  if (restIndex >= 0) {
    activities = activities.map((activity, index) =>
      index === restIndex ? rewardRest : activity,
    );
  } else {
    activities = [...activities, rewardRest];
  }
  activities = activities.map((activity) => {
    if (activity.countUp) return { ...activity, percentage: 0 };
    if (activity.id === BANKED_REST_ACTIVITY_ID || activity.isRewardRest) {
      return {
        ...activity,
        percentage:
          options.mode === "reserved"
            ? (targetSeconds / wholeSeconds(options.sessionTotalSeconds)) * 100
            : 0,
      };
    }
    if (options.mode !== "reserved") return activity;
    return {
      ...activity,
      percentage:
        (wholeSeconds(activity.timeRemaining) /
          wholeSeconds(options.sessionTotalSeconds)) *
        100,
    };
  });
  const donatedSecondsById = funded.transfer.byId;
  const visualSource =
    options.mode === "reserved"
      ? funded.activities
      : takeFromActivities(options.activities, targetSeconds).activities;
  const visualPlannedSecondsById = Object.fromEntries([
    ...visualSource
      .filter((activity) => !activity.countUp && !activity.isRewardRest)
      .map((activity) => [activity.id, wholeSeconds(activity.timeRemaining)]),
    [BANKED_REST_ACTIVITY_ID, targetSeconds],
  ]);
  const contract: SessionRewardContract = {
    version: 1,
    mode: options.mode,
    status: "active",
    targetSeconds,
    sessionTotalSeconds: wholeSeconds(options.sessionTotalSeconds),
    plannedWorkSeconds:
      wholeSeconds(options.sessionTotalSeconds) - targetSeconds,
    eligibleFocusedSeconds: 0,
    earnedSeconds: 0,
    consumedSeconds: 0,
    bankedSeconds: 0,
    discardedSeconds: 0,
    donatedSecondsById,
    visualPlannedSecondsById,
    operations:
      funded.transfer.amount > 0
        ? [
            {
              fundedSeconds: funded.transfer.amount,
              donatedSecondsById,
            },
          ]
        : [],
  };
  return { activities, contract, feasibility };
}

const eligibleFocusedSeconds = (
  activities: SessionRewardActivity[],
  slices: SessionActivitySlice[],
) => {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  return slices.reduce((sum, slice) => {
    const activity = byId.get(slice.activityId);
    return activity &&
      slice.kind === "countdown" &&
      !activity.countUp &&
      !activity.isRewardRest &&
      !activity.isSystemActivity
      ? sum + wholeSeconds(slice.durationSeconds)
      : sum;
  }, 0);
};

export function applySessionRewardSlices<
  T extends SessionRewardActivity,
>(options: {
  activities: T[];
  contract: SessionRewardContract;
  slices: SessionActivitySlice[];
}): {
  activities: T[];
  contract: SessionRewardContract;
  newlyEarnedSeconds: number;
} {
  const consumedNow = options.slices
    .filter((slice) => slice.activityId === BANKED_REST_ACTIVITY_ID)
    .reduce((sum, slice) => sum + wholeSeconds(slice.durationSeconds), 0);
  const focusedNow = eligibleFocusedSeconds(options.activities, options.slices);
  let contract: SessionRewardContract = {
    ...options.contract,
    consumedSeconds: Math.min(
      options.contract.earnedSeconds,
      options.contract.consumedSeconds + consumedNow,
    ),
    eligibleFocusedSeconds: Math.min(
      options.contract.plannedWorkSeconds,
      options.contract.eligibleFocusedSeconds + focusedNow,
    ),
  };
  const earnedTarget = Math.min(
    contract.targetSeconds,
    Math.floor(
      (contract.eligibleFocusedSeconds * contract.targetSeconds) /
        Math.max(1, contract.plannedWorkSeconds),
    ),
  );
  const requested = Math.max(0, earnedTarget - contract.earnedSeconds);
  const funded =
    contract.mode === "live"
      ? takeFromActivities(options.activities, requested)
      : {
          activities: options.activities,
          transfer: { amount: requested, byId: {} as Record<string, number> },
        };
  const newlyEarnedSeconds = funded.transfer.amount;
  if (newlyEarnedSeconds > 0) {
    const donatedSecondsById = { ...contract.donatedSecondsById };
    Object.entries(funded.transfer.byId).forEach(([id, seconds]) => {
      donatedSecondsById[id] = (donatedSecondsById[id] || 0) + seconds;
    });
    contract = {
      ...contract,
      earnedSeconds: contract.earnedSeconds + newlyEarnedSeconds,
      donatedSecondsById,
      operations:
        contract.mode === "live"
          ? [
              ...contract.operations,
              {
                fundedSeconds: newlyEarnedSeconds,
                donatedSecondsById: funded.transfer.byId,
              },
            ]
          : contract.operations,
    };
  }
  const available = sessionRewardAvailableSeconds(contract);
  const activities = funded.activities.map((activity) =>
    activity.id === BANKED_REST_ACTIVITY_ID || activity.isRewardRest
      ? ({
          ...activity,
          duration: contract.targetSeconds / 60,
          originalPlannedSeconds: contract.targetSeconds,
          sessionRewardTargetSeconds: contract.targetSeconds,
          timeRemaining: available,
          isCompleted: available <= 0,
          completedElapsedSeconds: contract.consumedSeconds,
        } as T)
      : activity,
  );
  return { activities, contract, newlyEarnedSeconds };
}

export function restoreSessionRewardContract<T extends SessionRewardActivity>(
  activities: T[],
  contract: SessionRewardContract,
  requestedRestoreSeconds?: number,
) {
  const rest = activities.find(
    (activity) =>
      activity.id === BANKED_REST_ACTIVITY_ID || activity.isRewardRest,
  );
  const restoreTotal = Number.isFinite(Number(requestedRestoreSeconds))
    ? wholeSeconds(requestedRestoreSeconds)
    : contract.mode === "reserved"
      ? Math.max(0, contract.targetSeconds)
      : Object.values(contract.donatedSecondsById).reduce(
          (sum, seconds) => sum + wholeSeconds(seconds),
          0,
        );
  const contributionEntries = Object.entries(contract.donatedSecondsById).map(
    ([id, seconds], index) => ({ id, seconds: wholeSeconds(seconds), index }),
  );
  const restore = proportionalTake(contributionEntries, restoreTotal).byId;
  return activities
    .filter((activity) => activity !== rest)
    .map((activity) => {
      const seconds = restore[activity.id] || 0;
      if (!seconds) return activity;
      const remaining =
        wholeSeconds(
          activity.originalPlannedSeconds ?? activity.timeRemaining,
        ) + seconds;
      return {
        ...activity,
        timeRemaining: remaining,
        duration: remaining / 60,
        originalPlannedSeconds: remaining,
      };
    });
}
