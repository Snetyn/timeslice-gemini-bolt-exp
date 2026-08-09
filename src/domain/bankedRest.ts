export const BANKED_REST_ACTIVITY_ID = "timeslice-banked-rest";

export type BankedRestActivity = {
  id: string;
  percentage?: number;
  duration?: number;
  timeRemaining?: number;
  originalPlannedSeconds?: number;
  countUp?: boolean;
  isCompleted?: boolean;
  completedElapsedSeconds?: number;
  priority?: boolean;
  isLocked?: boolean;
  isRewardRest?: boolean;
  rewardRestFunding?: RewardRestFunding;
};

export type RewardRestFunding = {
  donatedSecondsById: Record<string, number>;
  fundedSeconds: number;
  operations: RewardRestFundingOperation[];
};

export type RewardRestFundingOperation = {
  donatedSecondsById: Record<string, number>;
  fundedSeconds: number;
};

export type BankedRestAllocation<T extends BankedRestActivity> = {
  activities: T[];
  allocatedSeconds: number;
  remainingBankedSeconds: number;
  donatedSecondsById: Record<string, number>;
};

export type BankedRestRestoration<T extends BankedRestActivity> = {
  activities: T[];
  restoredSeconds: number;
  sessionVaultSeconds: number;
  removedRewardRest: boolean;
};

export type SessionRewardSlice = {
  activityId: string;
  durationSeconds: number;
};

const wholeSeconds = (value: unknown) =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function normalizeRewardRestFunding(
  value: unknown,
): RewardRestFunding | undefined {
  if (!isRecord(value)) return undefined;
  const normalizeMap = (map: unknown): Record<string, number> =>
    isRecord(map)
      ? Object.fromEntries(
          Object.entries(map)
            .filter(([id]) => Boolean(id.trim()))
            .map(([id, seconds]) => [id, wholeSeconds(seconds)] as const)
            .filter(([, seconds]) => seconds > 0),
        )
      : {};
  const donatedSecondsById = normalizeMap(value.donatedSecondsById);
  const donatedTotal = Object.values(donatedSecondsById).reduce(
    (sum, seconds) => sum + seconds,
    0,
  );
  const fundedSeconds = wholeSeconds(value.fundedSeconds);
  const operations = Array.isArray(value.operations)
    ? value.operations
        .map((operation): RewardRestFundingOperation | null => {
          if (!isRecord(operation)) return null;
          const operationMap = normalizeMap(operation.donatedSecondsById);
          const operationTotal = Object.values(operationMap).reduce(
            (sum, seconds) => sum + seconds,
            0,
          );
          const operationFunded =
            wholeSeconds(operation.fundedSeconds) || operationTotal;
          return operationFunded > 0
            ? {
                donatedSecondsById: operationMap,
                fundedSeconds: operationFunded,
              }
            : null;
        })
        .filter(
          (operation): operation is RewardRestFundingOperation =>
            operation !== null,
        )
    : [];
  if (!donatedTotal && !fundedSeconds && operations.length === 0)
    return undefined;
  const normalizedFundedSeconds = fundedSeconds || donatedTotal;
  return {
    donatedSecondsById,
    fundedSeconds: normalizedFundedSeconds,
    operations:
      operations.length > 0
        ? operations
        : [
            {
              donatedSecondsById,
              fundedSeconds: normalizedFundedSeconds,
            },
          ],
  };
}

export function scheduledRewardRestSeconds(activities: BankedRestActivity[]) {
  return activities.reduce(
    (sum, activity) =>
      activity.id === BANKED_REST_ACTIVITY_ID || activity.isRewardRest
        ? sum + wholeSeconds(activity.timeRemaining)
        : sum,
    0,
  );
}

export function rewardBankHoldings(
  availableBankSeconds: unknown,
  activities: BankedRestActivity[],
) {
  const scheduledSeconds = scheduledRewardRestSeconds(activities);
  const availableSeconds = wholeSeconds(availableBankSeconds);
  return {
    availableSeconds,
    scheduledSeconds,
    totalSeconds: availableSeconds + scheduledSeconds,
  };
}

export function rewardEligibleSessionSeconds(
  activities: BankedRestActivity[],
  slices: SessionRewardSlice[],
) {
  const restIds = new Set(
    activities
      .filter(
        (activity) =>
          activity.id === BANKED_REST_ACTIVITY_ID || activity.isRewardRest,
      )
      .map((activity) => activity.id),
  );
  return slices.reduce(
    (sum, slice) =>
      restIds.has(slice.activityId)
        ? sum
        : sum + wholeSeconds(slice.durationSeconds),
    0,
  );
}

function plannedSeconds(
  activity: BankedRestActivity,
  totalSessionSeconds: number,
) {
  const remaining = Number(activity.timeRemaining);
  if (!activity.countUp && Number.isFinite(remaining) && remaining >= 0) {
    return Math.floor(remaining);
  }
  const percentage = Number(activity.percentage);
  if (Number.isFinite(percentage) && percentage > 0) {
    return Math.max(0, Math.round((percentage / 100) * totalSessionSeconds));
  }
  return wholeSeconds(Number(activity.duration || 0) * 60);
}

function proportionalTake(
  donors: Array<{ id: string; seconds: number; index: number }>,
  requestedSeconds: number,
) {
  const total = donors.reduce((sum, donor) => sum + donor.seconds, 0);
  const amount = Math.min(total, requestedSeconds);
  if (!amount || !total)
    return { amount: 0, byId: {} as Record<string, number> };

  const shares = donors.map((donor) => {
    const exact = (amount * donor.seconds) / total;
    const seconds = Math.min(donor.seconds, Math.floor(exact));
    return {
      ...donor,
      seconds,
      fraction: exact - seconds,
    };
  });
  let remainder =
    amount - shares.reduce((sum, share) => sum + share.seconds, 0);
  const order = shares
    .map((share, shareIndex) => ({
      shareIndex,
      fraction: share.fraction,
      index: share.index,
    }))
    .sort(
      (left, right) =>
        right.fraction - left.fraction || left.index - right.index,
    );

  while (remainder > 0) {
    let changed = false;
    for (const item of order) {
      if (remainder <= 0) break;
      const share = shares[item.shareIndex];
      const capacity = donors[item.shareIndex].seconds;
      if (share.seconds >= capacity) continue;
      share.seconds += 1;
      remainder -= 1;
      changed = true;
    }
    if (!changed) break;
  }

  return {
    amount,
    byId: Object.fromEntries(shares.map((share) => [share.id, share.seconds])),
  };
}

function proportionalGive(
  recipients: Array<{ id: string; weight: number; index: number }>,
  requestedSeconds: number,
) {
  const amount = wholeSeconds(requestedSeconds);
  const totalWeight = recipients.reduce(
    (sum, recipient) => sum + Math.max(1, wholeSeconds(recipient.weight)),
    0,
  );
  if (!amount || !totalWeight) return {} as Record<string, number>;
  const shares = recipients.map((recipient) => {
    const exact =
      (amount * Math.max(1, wholeSeconds(recipient.weight))) / totalWeight;
    return {
      ...recipient,
      seconds: Math.floor(exact),
      fraction: exact - Math.floor(exact),
    };
  });
  let remainder =
    amount - shares.reduce((sum, share) => sum + share.seconds, 0);
  shares
    .map((share, shareIndex) => ({ ...share, shareIndex }))
    .sort(
      (left, right) =>
        right.fraction - left.fraction || left.index - right.index,
    )
    .forEach(({ shareIndex }) => {
      if (remainder <= 0) return;
      shares[shareIndex].seconds += 1;
      remainder -= 1;
    });
  return Object.fromEntries(shares.map((share) => [share.id, share.seconds]));
}

function scaleContributionMap(
  funding: RewardRestFunding | undefined,
  targetSeconds: number,
) {
  const entries = Object.entries(funding?.donatedSecondsById || {}).map(
    ([id, seconds], index) => ({ id, seconds: wholeSeconds(seconds), index }),
  );
  return proportionalTake(entries, wholeSeconds(targetSeconds)).byId;
}

/**
 * Converts banked Flow reward into scheduled Session rest while preserving the
 * total countdown duration. Starred tasks are protected from this automatic
 * proportional reduction; lock remains a manual allocation control only.
 */
export function allocateBankedRest<T extends BankedRestActivity>(options: {
  activities: T[];
  totalSessionSeconds: number;
  requestedSeconds: number;
  bankedSeconds: number;
  maxRewardRestSeconds?: number;
  createRestActivity: () => T;
}): BankedRestAllocation<T> {
  const totalSessionSeconds = wholeSeconds(options.totalSessionSeconds);
  const bankedSeconds = wholeSeconds(options.bankedSeconds);
  let requestedSeconds = Math.min(
    bankedSeconds,
    wholeSeconds(options.requestedSeconds),
  );
  if (!totalSessionSeconds || !requestedSeconds) {
    return {
      activities: options.activities,
      allocatedSeconds: 0,
      remainingBankedSeconds: bankedSeconds,
      donatedSecondsById: {},
    };
  }

  const current = new Map<string, number>();
  options.activities.forEach((activity) =>
    current.set(activity.id, plannedSeconds(activity, totalSessionSeconds)),
  );
  const donors = options.activities
    .map((activity, index) => ({
      activity,
      index,
      seconds: current.get(activity.id) || 0,
    }))
    .filter(
      ({ activity, seconds }) =>
        activity.id !== BANKED_REST_ACTIVITY_ID &&
        !activity.isRewardRest &&
        !activity.countUp &&
        !activity.isCompleted &&
        !activity.priority &&
        seconds > 0,
    )
    .map(({ activity, index, seconds }) => ({
      id: activity.id,
      index,
      seconds,
    }));
  const transfer = proportionalTake(donors, requestedSeconds);
  if (!transfer.amount) {
    return {
      activities: options.activities,
      allocatedSeconds: 0,
      remainingBankedSeconds: bankedSeconds,
      donatedSecondsById: {},
    };
  }

  const restIndex = options.activities.findIndex(
    (activity) =>
      activity.id === BANKED_REST_ACTIVITY_ID || activity.isRewardRest,
  );
  const rest =
    restIndex >= 0
      ? options.activities[restIndex]
      : options.createRestActivity();
  const existingRestSeconds = restIndex >= 0 ? current.get(rest.id) || 0 : 0;
  const restCap = wholeSeconds(options.maxRewardRestSeconds);
  if (restCap > 0) {
    requestedSeconds = Math.min(
      requestedSeconds,
      Math.max(0, restCap - existingRestSeconds),
    );
  }
  const cappedTransfer = proportionalTake(donors, requestedSeconds);
  if (!cappedTransfer.amount) {
    return {
      activities: options.activities,
      allocatedSeconds: 0,
      remainingBankedSeconds: bankedSeconds,
      donatedSecondsById: {},
    };
  }
  const restSeconds = existingRestSeconds + cappedTransfer.amount;
  const existingContributions = scaleContributionMap(
    normalizeRewardRestFunding(rest.rewardRestFunding),
    existingRestSeconds,
  );
  const existingFunding = normalizeRewardRestFunding(rest.rewardRestFunding);
  const donatedSecondsById = { ...existingContributions };
  Object.entries(cappedTransfer.byId).forEach(([id, seconds]) => {
    donatedSecondsById[id] = (donatedSecondsById[id] || 0) + seconds;
  });
  const next = options.activities.map((activity) => {
    const donated = cappedTransfer.byId[activity.id] || 0;
    const seconds =
      activity.id === rest.id
        ? restSeconds
        : Math.max(0, (current.get(activity.id) || 0) - donated);
    if (activity.countUp) return activity;
    return {
      ...activity,
      percentage: (seconds / totalSessionSeconds) * 100,
      duration: seconds / 60,
      timeRemaining: seconds,
      originalPlannedSeconds: seconds,
    };
  });

  if (restIndex < 0) {
    next.push({
      ...rest,
      id: BANKED_REST_ACTIVITY_ID,
      isRewardRest: true,
      percentage: (restSeconds / totalSessionSeconds) * 100,
      duration: restSeconds / 60,
      timeRemaining: restSeconds,
      originalPlannedSeconds: restSeconds,
      isCompleted: false,
      completedElapsedSeconds: 0,
      countUp: false,
      priority: true,
      rewardRestFunding: {
        donatedSecondsById,
        fundedSeconds: restSeconds,
        operations: [
          ...(existingFunding?.operations || []),
          {
            donatedSecondsById: cappedTransfer.byId,
            fundedSeconds: cappedTransfer.amount,
          },
        ],
      },
    });
  } else {
    const index = next.findIndex((activity) => activity.id === rest.id);
    next[index] = {
      ...next[index],
      id: BANKED_REST_ACTIVITY_ID,
      isRewardRest: true,
      isCompleted: false,
      completedElapsedSeconds: 0,
      countUp: false,
      priority: true,
      rewardRestFunding: {
        donatedSecondsById,
        fundedSeconds: restSeconds,
        operations: [
          ...(existingFunding?.operations || []),
          {
            donatedSecondsById: cappedTransfer.byId,
            fundedSeconds: cappedTransfer.amount,
          },
        ],
      },
    };
  }

  return {
    activities: next,
    allocatedSeconds: cappedTransfer.amount,
    remainingBankedSeconds: bankedSeconds - cappedTransfer.amount,
    donatedSecondsById: cappedTransfer.byId,
  };
}

/**
 * Removes unfinished Reward Rest and returns its Session allocation to the
 * original donors. Missing/completed donors are redistributed; the Session
 * Time Vault is the final fallback so the schedule total remains exact.
 */
export function restoreBankedRest<T extends BankedRestActivity>(options: {
  activities: T[];
  totalSessionSeconds: number;
  sessionVaultSeconds?: number;
}): BankedRestRestoration<T> {
  const restIndex = options.activities.findIndex(
    (activity) =>
      activity.id === BANKED_REST_ACTIVITY_ID || activity.isRewardRest,
  );
  if (restIndex < 0) {
    return {
      activities: options.activities,
      restoredSeconds: 0,
      sessionVaultSeconds: wholeSeconds(options.sessionVaultSeconds),
      removedRewardRest: false,
    };
  }
  const rest = options.activities[restIndex];
  const remaining = wholeSeconds(rest.timeRemaining);
  const funding = scaleContributionMap(
    normalizeRewardRestFunding(rest.rewardRestFunding),
    remaining,
  );
  const recipients = options.activities
    .map((activity, index) => ({ activity, index }))
    .filter(
      ({ activity }) =>
        activity.id !== rest.id &&
        !activity.isRewardRest &&
        !activity.countUp &&
        !activity.isCompleted,
    );
  const byId: Record<string, number> = {};
  let unresolved = remaining;
  for (const { activity } of recipients) {
    const original = Math.min(unresolved, wholeSeconds(funding[activity.id]));
    if (!original) continue;
    byId[activity.id] = original;
    unresolved -= original;
  }
  if (unresolved > 0 && recipients.length > 0) {
    const redistributed = proportionalGive(
      recipients.map(({ activity, index }) => ({
        id: activity.id,
        index,
        weight: wholeSeconds(activity.timeRemaining) || 1,
      })),
      unresolved,
    );
    Object.entries(redistributed).forEach(([id, seconds]) => {
      byId[id] = (byId[id] || 0) + seconds;
    });
    unresolved -= Object.values(redistributed).reduce(
      (sum, seconds) => sum + seconds,
      0,
    );
  }
  const totalSessionSeconds = wholeSeconds(options.totalSessionSeconds);
  const activities = options.activities
    .filter((_, index) => index !== restIndex)
    .map((activity) => {
      const restored = byId[activity.id] || 0;
      if (!restored) return activity;
      const seconds = wholeSeconds(activity.timeRemaining) + restored;
      return {
        ...activity,
        timeRemaining: seconds,
        duration: seconds / 60,
        originalPlannedSeconds: seconds,
        percentage:
          totalSessionSeconds > 0
            ? (seconds / totalSessionSeconds) * 100
            : activity.percentage,
      };
    });
  return {
    activities,
    restoredSeconds: remaining,
    sessionVaultSeconds:
      wholeSeconds(options.sessionVaultSeconds) + Math.max(0, unresolved),
    removedRewardRest: true,
  };
}
