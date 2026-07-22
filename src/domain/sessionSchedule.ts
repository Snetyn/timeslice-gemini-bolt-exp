import type { SessionActivityLike } from "../lib/session";

export type VaultPredictionMode = "linked" | "independent";

export const remainingCountdownSeconds = (
  activities: SessionActivityLike[],
) =>
  activities.reduce((total, activity) => {
    if (activity.isCompleted || activity.countUp) return total;
    return total + Math.max(0, Number(activity.timeRemaining) || 0);
  }, 0);

export const predictedScheduleSeconds = (
  activities: SessionActivityLike[],
  vaultSeconds = 0,
  mode: VaultPredictionMode = "linked",
) =>
  remainingCountdownSeconds(activities) +
  (mode === "independent"
    ? Math.max(0, Math.floor(Number(vaultSeconds) || 0))
    : 0);

export const predictedEndAtMs = (
  activities: SessionActivityLike[],
  nowMs: number,
  vaultSeconds = 0,
  mode: VaultPredictionMode = "linked",
) => nowMs + predictedScheduleSeconds(activities, vaultSeconds, mode) * 1_000;
