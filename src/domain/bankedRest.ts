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
};

export type BankedRestAllocation<T extends BankedRestActivity> = {
  activities: T[];
  allocatedSeconds: number;
  remainingBankedSeconds: number;
  donatedSecondsById: Record<string, number>;
};

export type SessionRewardSlice = {
  activityId: string;
  durationSeconds: number;
};

const wholeSeconds = (value: unknown) =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

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
  createRestActivity: () => T;
}): BankedRestAllocation<T> {
  const totalSessionSeconds = wholeSeconds(options.totalSessionSeconds);
  const bankedSeconds = wholeSeconds(options.bankedSeconds);
  const requestedSeconds = Math.min(
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
  const restSeconds =
    (restIndex >= 0 ? current.get(rest.id) || 0 : 0) + transfer.amount;
  const next = options.activities.map((activity) => {
    const donated = transfer.byId[activity.id] || 0;
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
    };
  }

  return {
    activities: next,
    allocatedSeconds: transfer.amount,
    remainingBankedSeconds: bankedSeconds - transfer.amount,
    donatedSecondsById: transfer.byId,
  };
}
