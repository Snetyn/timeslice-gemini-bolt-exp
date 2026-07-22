import {
  drainFlowBreakActivities,
  type SessionActivityLike,
} from "../lib/session";

export type SessionOvertimeMode = "none" | "drain" | "postpone";
export type FlowBreakMode = "none" | "drain" | "postpone";

export type SessionRunActivity = SessionActivityLike & {
  duration: number;
  timeRemaining: number;
  sharedId?: string;
};

export type SessionAdvanceInput = {
  activities: SessionRunActivity[];
  currentActivityIndex: number;
  elapsedSeconds: number;
  overtimeMode: SessionOvertimeMode;
  flowBreakMode?: FlowBreakMode;
  flowBreakRemainingSeconds?: number;
  vaultSeconds?: number;
  flowDrainSourceId?: string | null;
  donorCursor?: number;
};

export type SessionAdvanceResult = {
  activities: SessionRunActivity[];
  currentActivityIndex: number;
  isComplete: boolean;
  vaultSeconds: number;
  flowDrainSourceId: string | null;
  donorCursor: number;
  donatedSecondsById: Record<string, number>;
  receivedSecondsById: Record<string, number>;
  completedActivityIds: string[];
};

const safeSeconds = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value || 0)) : 0;

const plannedSeconds = (activity: SessionRunActivity) =>
  activity.countUp ? 0 : safeSeconds(Number(activity.duration || 0) * 60);

const ensureRemaining = (activity: SessionRunActivity) => ({
  ...activity,
  timeRemaining: Number.isFinite(activity.timeRemaining)
    ? activity.timeRemaining
    : activity.countUp
      ? 0
      : plannedSeconds(activity),
});

const drainTier = (activity: SessionRunActivity) =>
  activity.priority ? (activity.isLocked ? 3 : 2) : activity.isLocked ? 1 : 0;

const nextIncompleteIndex = (
  activities: SessionRunActivity[],
  afterIndex: number,
) => {
  for (let offset = 1; offset <= activities.length; offset += 1) {
    const index = (afterIndex + offset) % activities.length;
    if (!activities[index]?.isCompleted) return index;
  }
  return -1;
};

/**
 * Applies one elapsed batch to a Session. Live ticks, background recovery and
 * app-start recovery all use this exact transition, so task completion and
 * Flowmodoro drain ordering cannot diverge between code paths.
 */
export function advanceSessionRun({
  activities: sourceActivities,
  currentActivityIndex,
  elapsedSeconds,
  overtimeMode,
  flowBreakMode = "none",
  flowBreakRemainingSeconds = 0,
  vaultSeconds = 0,
  flowDrainSourceId = null,
  donorCursor = -1,
}: SessionAdvanceInput): SessionAdvanceResult {
  let activities = sourceActivities.map(ensureRemaining);
  let cursor = Math.max(
    0,
    Math.min(Math.floor(currentActivityIndex || 0), activities.length - 1),
  );
  let remainingBatch = safeSeconds(elapsedSeconds);
  let nextVault = safeSeconds(vaultSeconds);
  let nextFlowSource = flowDrainSourceId;
  let nextDonorCursor = Number.isFinite(donorCursor)
    ? Math.floor(donorCursor || -1)
    : -1;
  const donatedSecondsById: Record<string, number> = {};
  const receivedSecondsById: Record<string, number> = {};
  const completedActivityIds: string[] = [];

  const breakSeconds = Math.min(
    remainingBatch,
    safeSeconds(flowBreakRemainingSeconds),
  );
  if (flowBreakMode === "postpone") {
    remainingBatch -= breakSeconds;
    nextFlowSource = null;
  } else if (flowBreakMode === "drain" && breakSeconds > 0) {
    const vaultDrain = Math.min(nextVault, breakSeconds);
    nextVault -= vaultDrain;
    const activityDrain = breakSeconds - vaultDrain;
    if (activityDrain > 0) {
      const drained = drainFlowBreakActivities(
        activities,
        activityDrain,
        nextFlowSource,
      );
      activities = drained.activities as SessionRunActivity[];
      nextFlowSource = drained.sourceId;
      Object.entries(drained.drainedSecondsById).forEach(([id, seconds]) => {
        donatedSecondsById[id] = (donatedSecondsById[id] || 0) + seconds;
      });
    }
    remainingBatch -= breakSeconds;
  } else {
    nextFlowSource = null;
  }

  let safety = 0;
  while (remainingBatch > 0 && activities.length > 0 && safety < 100_000) {
    safety += 1;
    let current = activities[cursor];
    if (!current || current.isCompleted) {
      const next = nextIncompleteIndex(activities, cursor);
      if (next < 0) break;
      cursor = next;
      current = activities[cursor];
    }

    if (current.countUp) {
      current.timeRemaining =
        safeSeconds(current.timeRemaining) + remainingBatch;
      remainingBatch = 0;
      break;
    }

    if (current.timeRemaining > 0) {
      const consumed = Math.min(remainingBatch, current.timeRemaining);
      current.timeRemaining -= consumed;
      remainingBatch -= consumed;
      if (remainingBatch === 0) break;
    }

    if (overtimeMode === "postpone") {
      current.timeRemaining -= remainingBatch;
      remainingBatch = 0;
      break;
    }

    if (overtimeMode === "drain") {
      const donors = activities
        .map((activity, index) => ({ activity, index }))
        .filter(
          ({ activity, index }) =>
            index !== cursor &&
            !activity.isCompleted &&
            !activity.countUp &&
            activity.timeRemaining > 0,
        )
        .sort(
          (left, right) =>
            drainTier(left.activity) - drainTier(right.activity) ||
            left.index - right.index,
        );
      if (donors.length > 0) {
        nextDonorCursor = (nextDonorCursor + 1) % donors.length;
        const donor = donors[nextDonorCursor].activity;
        donor.timeRemaining -= 1;
        donatedSecondsById[donor.id] = (donatedSecondsById[donor.id] || 0) + 1;
        receivedSecondsById[current.id] =
          (receivedSecondsById[current.id] || 0) + 1;
      }
      current.timeRemaining -= 1;
      remainingBatch -= 1;
      continue;
    }

    current.isCompleted = true;
    current.timeRemaining = 0;
    current.completedElapsedSeconds = Math.max(
      safeSeconds(current.completedElapsedSeconds),
      plannedSeconds(current),
    );
    completedActivityIds.push(current.id);
    const next = nextIncompleteIndex(activities, cursor);
    if (next < 0) {
      remainingBatch = 0;
      break;
    }
    cursor = next;
  }

  return {
    activities,
    currentActivityIndex: cursor,
    isComplete:
      activities.length > 0 &&
      activities.every((activity) => activity.isCompleted),
    vaultSeconds: nextVault,
    flowDrainSourceId: nextFlowSource,
    donorCursor: nextDonorCursor,
    donatedSecondsById,
    receivedSecondsById,
    completedActivityIds,
  };
}
