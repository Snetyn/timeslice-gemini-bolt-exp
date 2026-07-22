export type ClockAnchor = {
  observedAtMs: number;
  remainderMs: number;
};

export type ClockBatch = {
  anchor: ClockAnchor;
  elapsedSeconds: number;
};

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const createClockAnchor = (nowMs = Date.now()): ClockAnchor => ({
  observedAtMs: finiteNonNegative(nowMs),
  remainderMs: 0,
});

/**
 * Samples wall-clock time into whole-second batches. The returned anchor is
 * monotonic and therefore safe to sample from interval, focus, pageshow and
 * visibility events without crediting the same period twice.
 */
export const advanceClock = (
  anchor: ClockAnchor,
  nowMs = Date.now(),
): ClockBatch => {
  const observedAtMs = Math.max(
    finiteNonNegative(nowMs),
    finiteNonNegative(anchor.observedAtMs),
  );
  const elapsedMs =
    observedAtMs -
    finiteNonNegative(anchor.observedAtMs) +
    Math.min(999, finiteNonNegative(anchor.remainderMs));
  const elapsedSeconds = Math.floor(elapsedMs / 1_000);

  return {
    anchor: {
      observedAtMs,
      remainderMs: elapsedMs - elapsedSeconds * 1_000,
    },
    elapsedSeconds,
  };
};
