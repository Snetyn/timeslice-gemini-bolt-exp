export type TimerStatus =
  "idle" | "running" | "paused" | "completed" | "cancelled";

/**
 * Persisted timer state. `startedAtMs` is an anchor, never a ticking counter.
 * While the timer is running, its elapsed value is derived at read time.
 */
export type TimerState = {
  id: string;
  status: TimerStatus;
  startedAtMs: number | null;
  accumulatedMs: number;
  targetDurationMs: number | null;
  endAtMs: number | null;
  revision: number;
  updatedAtMs: number;
  /** Highest wall-clock value observed for this timer. Prevents clock rollback. */
  lastObservedAtMs: number;
};

export type TimerSnapshot = {
  elapsedMs: number;
  remainingMs: number | null;
  isExpired: boolean;
  observedAtMs: number;
};

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const createTimer = (
  id: string,
  nowMs = Date.now(),
  targetDurationMs: number | null = null,
): TimerState => ({
  id,
  status: "idle",
  startedAtMs: null,
  accumulatedMs: 0,
  targetDurationMs:
    targetDurationMs === null ? null : finiteNonNegative(targetDurationMs),
  endAtMs: null,
  revision: 0,
  updatedAtMs: finiteNonNegative(nowMs),
  lastObservedAtMs: finiteNonNegative(nowMs),
});

/** A wall-clock sample that never moves backwards for one persisted timer. */
export const observeNow = (timer: TimerState, nowMs = Date.now()) =>
  Math.max(finiteNonNegative(nowMs), timer.lastObservedAtMs || 0);

export const elapsedAt = (timer: TimerState, nowMs = Date.now()) => {
  if (timer.status !== "running" || timer.startedAtMs === null) {
    return finiteNonNegative(timer.accumulatedMs);
  }
  const observedAtMs = observeNow(timer, nowMs);
  return (
    finiteNonNegative(timer.accumulatedMs) +
    Math.max(0, observedAtMs - timer.startedAtMs)
  );
};

export const snapshotTimer = (
  timer: TimerState,
  nowMs = Date.now(),
): TimerSnapshot => {
  const observedAtMs = observeNow(timer, nowMs);
  const elapsedMs = elapsedAt(timer, observedAtMs);
  const remainingMs =
    timer.targetDurationMs === null
      ? null
      : Math.max(0, finiteNonNegative(timer.targetDurationMs) - elapsedMs);
  return {
    elapsedMs,
    remainingMs,
    isExpired: remainingMs === 0 && timer.targetDurationMs !== null,
    observedAtMs,
  };
};

const next = (
  timer: TimerState,
  nowMs: number,
  patch: Partial<TimerState>,
): TimerState => ({
  ...timer,
  ...patch,
  revision: timer.revision + 1,
  updatedAtMs: nowMs,
  lastObservedAtMs: nowMs,
});

export const startTimer = (
  timer: TimerState,
  nowMs = Date.now(),
): TimerState => {
  const observedAtMs = observeNow(timer, nowMs);
  if (timer.status === "running")
    return { ...timer, lastObservedAtMs: observedAtMs };
  const elapsedMs = elapsedAt(timer, observedAtMs);
  return next(timer, observedAtMs, {
    status: "running",
    startedAtMs: observedAtMs,
    accumulatedMs: elapsedMs,
    endAtMs:
      timer.targetDurationMs === null
        ? null
        : observedAtMs + Math.max(0, timer.targetDurationMs - elapsedMs),
  });
};

export const pauseTimer = (
  timer: TimerState,
  nowMs = Date.now(),
): TimerState => {
  const observedAtMs = observeNow(timer, nowMs);
  if (timer.status !== "running")
    return { ...timer, lastObservedAtMs: observedAtMs };
  return next(timer, observedAtMs, {
    status: "paused",
    startedAtMs: null,
    accumulatedMs: elapsedAt(timer, observedAtMs),
    endAtMs: null,
  });
};

/** Stores a running timer's current anchor at a lifecycle boundary. */
export const checkpointTimer = (
  timer: TimerState,
  nowMs = Date.now(),
): TimerState => {
  const observedAtMs = observeNow(timer, nowMs);
  if (timer.status !== "running")
    return { ...timer, lastObservedAtMs: observedAtMs };
  if (
    timer.startedAtMs === observedAtMs &&
    timer.lastObservedAtMs === observedAtMs
  ) {
    return timer;
  }
  const accumulatedMs = elapsedAt(timer, observedAtMs);
  return next(timer, observedAtMs, {
    startedAtMs: observedAtMs,
    accumulatedMs,
    endAtMs:
      timer.targetDurationMs === null
        ? null
        : observedAtMs + Math.max(0, timer.targetDurationMs - accumulatedMs),
  });
};

export const resetTimer = (
  timer: TimerState,
  nowMs = Date.now(),
  targetDurationMs = timer.targetDurationMs,
): TimerState => {
  const observedAtMs = observeNow(timer, nowMs);
  return next(timer, observedAtMs, {
    status: "idle",
    startedAtMs: null,
    accumulatedMs: 0,
    targetDurationMs:
      targetDurationMs === null ? null : finiteNonNegative(targetDurationMs),
    endAtMs: null,
  });
};

/**
 * Commit elapsed wall-clock time only at a meaningful boundary. Calling this
 * repeatedly at the same time is idempotent and never credits time twice.
 */
export const reconcileTimer = (
  timer: TimerState,
  nowMs = Date.now(),
): TimerState => {
  const observedAtMs = observeNow(timer, nowMs);
  if (timer.status !== "running") {
    return { ...timer, lastObservedAtMs: observedAtMs };
  }
  const snapshot = snapshotTimer(timer, observedAtMs);
  if (!snapshot.isExpired) return { ...timer, lastObservedAtMs: observedAtMs };
  return next(timer, observedAtMs, {
    status: "completed",
    startedAtMs: null,
    accumulatedMs: snapshot.elapsedMs,
    endAtMs: observedAtMs,
  });
};

export const cancelTimer = (
  timer: TimerState,
  nowMs = Date.now(),
): TimerState => {
  const observedAtMs = observeNow(timer, nowMs);
  return next(timer, observedAtMs, {
    status: "cancelled",
    startedAtMs: null,
    accumulatedMs: elapsedAt(timer, observedAtMs),
    endAtMs: null,
  });
};

export const completeTimer = (
  timer: TimerState,
  nowMs = Date.now(),
): TimerState => {
  const observedAtMs = observeNow(timer, nowMs);
  return next(timer, observedAtMs, {
    status: "completed",
    startedAtMs: null,
    accumulatedMs: elapsedAt(timer, observedAtMs),
    endAtMs: observedAtMs,
  });
};
