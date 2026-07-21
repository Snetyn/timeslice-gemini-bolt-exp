export type SessionActivityLike = {
  id: string;
  name?: string;
  color?: string;
  percentage?: number;
  duration?: number;
  timeRemaining?: number;
  countUp?: boolean;
  isCompleted?: boolean;
  completedElapsedSeconds?: number;
  showOnBar?: boolean;
  priority?: boolean;
  isLocked?: boolean;
};

export type ProgressEntry = SessionActivityLike & {
  plannedSeconds: number;
  elapsedSeconds: number;
  visibleInPlan: boolean;
};

export const getPlannedSeconds = (
  activity: SessionActivityLike,
  totalSessionSeconds: number,
) => {
  if (activity.countUp) return 0;
  if (activity.percentage && activity.percentage > 0) {
    return Math.max(0, (activity.percentage / 100) * totalSessionSeconds);
  }
  return Math.max(0, (activity.duration || 0) * 60);
};

export const getElapsedSeconds = (
  activity: SessionActivityLike,
  totalSessionSeconds: number,
) => {
  if (
    activity.isCompleted &&
    Number.isFinite(activity.completedElapsedSeconds)
  ) {
    return Math.max(0, activity.completedElapsedSeconds || 0);
  }
  if (activity.countUp) return Math.max(0, activity.timeRemaining || 0);

  const planned = getPlannedSeconds(activity, totalSessionSeconds);
  const remaining = activity.timeRemaining;
  if (!Number.isFinite(remaining)) return 0;
  return Math.max(0, planned - (remaining || 0));
};

export const buildProgressEntries = (
  activities: SessionActivityLike[],
  totalSessionSeconds: number,
): ProgressEntry[] =>
  activities.map((activity) => {
    const plannedSeconds = getPlannedSeconds(activity, totalSessionSeconds);
    const elapsedSeconds = getElapsedSeconds(activity, totalSessionSeconds);
    return {
      ...activity,
      plannedSeconds,
      elapsedSeconds,
      // A blank, zero-allocation item remains editable in the list but cannot
      // participate in planned geometry. Count-up joins dynamic geometry only
      // after it has meaningful elapsed time.
      visibleInPlan: plannedSeconds > 0,
    };
  });

export const dynamicProgressEntries = (entries: ProgressEntry[]) =>
  entries.filter((entry) => entry.elapsedSeconds > 0);

/**
 * Converts percentages to whole seconds while guaranteeing that the allocated
 * countdown total is exactly the requested session duration. The final few
 * seconds are assigned by largest fractional remainder, so sliders and number
 * inputs cannot accumulate rounding drift.
 */
export const allocateSessionSeconds = (
  activities: SessionActivityLike[],
  totalSessionSeconds: number,
): Record<string, number> => {
  const safeTotal = Math.max(0, Math.floor(totalSessionSeconds));
  const countdown = activities.filter((activity) => !activity.countUp);
  const percentageTotal = countdown.reduce(
    (sum, activity) => sum + Math.max(0, Number(activity.percentage) || 0),
    0,
  );
  if (!countdown.length || percentageTotal <= 0 || safeTotal <= 0) {
    return Object.fromEntries(activities.map((activity) => [activity.id, 0]));
  }

  const allocations = countdown.map((activity, index) => {
    const exact =
      (Math.max(0, Number(activity.percentage) || 0) / percentageTotal) *
      safeTotal;
    const seconds = Math.floor(exact);
    return { id: activity.id, index, seconds, fraction: exact - seconds };
  });
  let remainder =
    safeTotal - allocations.reduce((sum, item) => sum + item.seconds, 0);
  allocations
    .slice()
    .sort(
      (left, right) =>
        right.fraction - left.fraction || left.index - right.index,
    )
    .forEach((item) => {
      if (remainder <= 0) return;
      const target = allocations.find((entry) => entry.id === item.id);
      if (target) target.seconds += 1;
      remainder -= 1;
    });

  return Object.fromEntries([
    ...activities
      .filter((activity) => activity.countUp)
      .map((activity) => [activity.id, 0]),
    ...allocations.map((item) => [item.id, item.seconds]),
  ]);
};

export const drainFlowBreakActivities = (
  activities: SessionActivityLike[],
  seconds: number,
  preferredSourceId: string | null = null,
) => {
  const next = activities.map((activity) => ({ ...activity }));
  const drainedSecondsById: Record<string, number> = {};
  let remaining = Math.max(0, Math.floor(seconds));
  let sourceId = preferredSourceId;

  const isEligible = (activity: SessionActivityLike | undefined) =>
    Boolean(
      activity &&
        !activity.isCompleted &&
        !activity.countUp &&
        Number.isFinite(activity.timeRemaining) &&
        (activity.timeRemaining || 0) > 0,
    );
  const tier = (activity: SessionActivityLike) =>
    activity.priority ? (activity.isLocked ? 3 : 2) : activity.isLocked ? 1 : 0;

  while (remaining > 0) {
    let source = next.find((activity) => activity.id === sourceId);
    if (!isEligible(source)) {
      source = next
        .map((activity, index) => ({ activity, index }))
        .filter(({ activity }) => isEligible(activity))
        .sort(
          (left, right) =>
            tier(left.activity) - tier(right.activity) ||
            left.index - right.index,
        )[0]?.activity;
      sourceId = source?.id || null;
    }
    if (!source) break;

    const drained = Math.min(remaining, Math.max(0, source.timeRemaining || 0));
    source.timeRemaining = Math.max(0, (source.timeRemaining || 0) - drained);
    drainedSecondsById[source.id] =
      (drainedSecondsById[source.id] || 0) + drained;
    remaining -= drained;
    if ((source.timeRemaining || 0) <= 0) sourceId = null;
  }

  return {
    activities: next,
    sourceId,
    drainedSecondsById,
    drainedSeconds: Math.max(0, Math.floor(seconds)) - remaining,
  };
};

export type EarlyCompletionPolicy = "vault" | "target" | "distribute";

export const distributeEarlyCompletion = (
  activities: SessionActivityLike[],
  completedId: string,
  seconds: number,
  policy: EarlyCompletionPolicy,
  targetId?: string,
) => {
  const remaining = Math.max(0, Math.floor(seconds));
  if (!remaining || policy === "vault") {
    return { activities, vaultSeconds: remaining };
  }

  const eligible = activities.filter(
    (activity) =>
      activity.id !== completedId &&
      !activity.isCompleted &&
      !activity.countUp &&
      Number.isFinite(activity.timeRemaining),
  );
  if (!eligible.length) return { activities, vaultSeconds: remaining };

  const target =
    policy === "target"
      ? eligible.find((item) => item.id === targetId)
      : undefined;
  const recipients = target ? [target] : eligible;
  const weights = recipients.map((item) =>
    Math.max(0, item.timeRemaining || 0),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let unassigned = remaining;
  const additions = recipients.map((_, index) => {
    const raw =
      totalWeight > 0
        ? Math.floor((remaining * weights[index]) / totalWeight)
        : Math.floor(remaining / recipients.length);
    unassigned -= raw;
    return raw;
  });
  for (let index = 0; unassigned > 0; index = (index + 1) % additions.length) {
    additions[index] += 1;
    unassigned -= 1;
  }

  const additionById = new Map(
    recipients.map((item, index) => [item.id, additions[index]]),
  );
  return {
    activities: activities.map((activity) =>
      additionById.has(activity.id)
        ? {
            ...activity,
            timeRemaining:
              Math.max(0, activity.timeRemaining || 0) +
              (additionById.get(activity.id) || 0),
          }
        : activity,
    ),
    vaultSeconds: 0,
  };
};
