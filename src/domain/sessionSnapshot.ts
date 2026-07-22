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
  activities: unknown[];
  vaultSeconds: number;
  flowmodoroState?: unknown;
};

const nonNegativeInteger = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
};

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
