export type SessionRunStatus = "idle" | "running" | "paused";

export type SessionRunSnapshot = {
  version: 1;
  status: SessionRunStatus;
  currentActivityIndex: number;
  lastReconciledAtMs: number | null;
  sessionPlanFrozen: boolean;
  initialAllocatedSeconds: number | null;
  // Compatibility fields retained for rollback to older TimeSlice builds.
  isTimerActive: boolean;
  isPaused: boolean;
  lastActiveTimestamp: number | null;
};

export type PersistedSessionRun = {
  snapshot: SessionRunSnapshot;
  activities: PersistedSessionActivity[];
  vaultSeconds: number;
  flowmodoroState?: PersistedFlowmodoroState;
};

export type PersistedSessionActivity = {
  id: string;
  name: string;
  color: string;
  duration: number;
  timeRemaining: number;
  percentage?: number;
  countUp?: boolean;
  isCompleted?: boolean;
  completedElapsedSeconds?: number;
  isLocked?: boolean;
  priority?: boolean;
  showOnBar?: boolean;
  sharedId?: string;
  templateId?: string;
  category?: string;
  tags?: string[];
  [key: string]: unknown;
};

export type PersistedFlowmodoroState = {
  availableRestTime: number;
  totalEarnedToday: number;
  cycleCount: number;
  isOnBreak: boolean;
  breakTimeRemaining: number;
  initialBreakDuration: number;
  lastResetDate: string;
  accumulatedFractionalTime: number;
  pendingCatchup?: number;
  [key: string]: unknown;
};

const nonNegativeInteger = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
};

const finiteNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const createSessionRunSnapshot = (input: {
  status: SessionRunStatus;
  currentActivityIndex: number;
  lastReconciledAtMs?: number | null;
  sessionPlanFrozen: boolean;
  initialAllocatedSeconds?: number | null;
}): SessionRunSnapshot => {
  const running = input.status === "running";
  const active = input.status !== "idle";
  const anchor = running
    ? nonNegativeInteger(input.lastReconciledAtMs ?? Date.now())
    : null;
  const initial = nonNegativeInteger(input.initialAllocatedSeconds);
  return {
    version: 1,
    status: input.status,
    currentActivityIndex: nonNegativeInteger(input.currentActivityIndex),
    lastReconciledAtMs: anchor,
    sessionPlanFrozen: Boolean(input.sessionPlanFrozen),
    initialAllocatedSeconds: initial > 0 ? initial : null,
    isTimerActive: active,
    isPaused: input.status === "paused",
    lastActiveTimestamp: anchor,
  };
};

/** Validates both the v1 checkpoint and the older unversioned shape. */
export const normalizeSessionRunSnapshot = (
  value: unknown,
): SessionRunSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const legacyActive = Boolean(record.isTimerActive);
  const legacyPaused = Boolean(record.isPaused);
  const status: SessionRunStatus =
    record.status === "running" ||
    record.status === "paused" ||
    record.status === "idle"
      ? record.status
      : legacyActive
        ? legacyPaused
          ? "paused"
          : "running"
        : "idle";
  return createSessionRunSnapshot({
    status,
    currentActivityIndex: nonNegativeInteger(record.currentActivityIndex),
    lastReconciledAtMs: nonNegativeInteger(
      record.lastReconciledAtMs ?? record.lastActiveTimestamp,
    ),
    sessionPlanFrozen: Boolean(record.sessionPlanFrozen),
    initialAllocatedSeconds: nonNegativeInteger(record.initialAllocatedSeconds),
  });
};

export const normalizePersistedSessionActivity = (
  value: unknown,
): PersistedSessionActivity | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!id || !name) return null;

  const countUp = Boolean(value.countUp);
  const duration = Math.max(0, finiteNumber(value.duration));
  const defaultRemaining = countUp ? 0 : duration * 60;
  const timeRemaining = finiteNumber(value.timeRemaining, defaultRemaining);
  const percentage = finiteNumber(value.percentage, Number.NaN);
  const completedElapsedSeconds = finiteNumber(
    value.completedElapsedSeconds,
    Number.NaN,
  );

  return {
    ...value,
    id,
    name,
    color:
      typeof value.color === "string" && value.color.trim()
        ? value.color
        : "#64748b",
    duration,
    timeRemaining: countUp ? Math.max(0, timeRemaining) : timeRemaining,
    percentage: Number.isFinite(percentage)
      ? Math.max(0, percentage)
      : undefined,
    countUp,
    isCompleted: Boolean(value.isCompleted),
    completedElapsedSeconds: Number.isFinite(completedElapsedSeconds)
      ? Math.max(0, completedElapsedSeconds)
      : undefined,
    isLocked: Boolean(value.isLocked),
    priority: Boolean(value.priority),
    showOnBar: value.showOnBar !== false,
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
  };
};

export const normalizePersistedFlowmodoroState = (
  value: unknown,
): PersistedFlowmodoroState | undefined => {
  if (!isRecord(value)) return undefined;
  const pendingCatchup = nonNegativeInteger(value.pendingCatchup);
  const breakTimeRemaining = nonNegativeInteger(value.breakTimeRemaining);
  const lastResetDate =
    typeof value.lastResetDate === "string" &&
    Number.isFinite(new Date(value.lastResetDate).getTime())
      ? value.lastResetDate
      : new Date().toDateString();
  return {
    ...value,
    availableRestTime: nonNegativeInteger(value.availableRestTime),
    totalEarnedToday: nonNegativeInteger(value.totalEarnedToday),
    cycleCount: nonNegativeInteger(value.cycleCount),
    isOnBreak: Boolean(value.isOnBreak) && breakTimeRemaining > 0,
    breakTimeRemaining,
    initialBreakDuration: nonNegativeInteger(value.initialBreakDuration),
    lastResetDate,
    accumulatedFractionalTime: Math.max(
      0,
      finiteNumber(value.accumulatedFractionalTime),
    ),
    pendingCatchup: pendingCatchup > 0 ? pendingCatchup : undefined,
  };
};

export const normalizePersistedSessionRun = (
  value: unknown,
): PersistedSessionRun | null => {
  if (!isRecord(value)) return null;
  const snapshot = normalizeSessionRunSnapshot(value.snapshot);
  if (!snapshot) return null;
  const activities = Array.isArray(value.activities)
    ? value.activities
        .map(normalizePersistedSessionActivity)
        .filter(
          (activity): activity is PersistedSessionActivity =>
            activity !== null,
        )
    : [];
  const flowmodoroState = normalizePersistedFlowmodoroState(
    value.flowmodoroState,
  );
  return {
    snapshot,
    activities,
    vaultSeconds: nonNegativeInteger(value.vaultSeconds),
    ...(flowmodoroState ? { flowmodoroState } : {}),
  };
};
