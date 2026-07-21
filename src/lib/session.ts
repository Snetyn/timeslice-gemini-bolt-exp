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
