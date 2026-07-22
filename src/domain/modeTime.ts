export type AnchoredElapsedState = {
  accumulatedSeconds?: number;
  startedAt?: Date | string | number | null;
  running?: boolean;
};

const timestampOf = (value: AnchoredElapsedState["startedAt"]) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime();
  return Number.NaN;
};

/** Derives elapsed seconds without changing the persisted accumulated value. */
export function elapsedSecondsAt(
  state: AnchoredElapsedState,
  nowMs = Date.now(),
) {
  const accumulated = Number.isFinite(state.accumulatedSeconds)
    ? Math.max(0, Math.floor(state.accumulatedSeconds || 0))
    : 0;
  const startedAtMs = timestampOf(state.startedAt);
  if (!state.running || !Number.isFinite(startedAtMs)) return accumulated;
  const safeNow = Number.isFinite(nowMs) ? nowMs : startedAtMs;
  return accumulated + Math.max(0, Math.floor((safeNow - startedAtMs) / 1_000));
}

export const pauseAnchoredElapsed = <T extends AnchoredElapsedState>(
  state: T,
  nowMs = Date.now(),
): T => ({
  ...state,
  accumulatedSeconds: elapsedSecondsAt(state, nowMs),
  startedAt: null,
  running: false,
});

export const resumeAnchoredElapsed = <T extends AnchoredElapsedState>(
  state: T,
  nowMs = Date.now(),
): T => ({
  ...state,
  startedAt: new Date(nowMs),
  running: true,
});
