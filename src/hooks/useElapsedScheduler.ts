import { useCallback, useEffect, useRef } from "react";
import { advanceClock, createClockAnchor } from "../domain/clock";

type ElapsedSchedulerOptions = {
  enabled: boolean;
  onElapsed: (elapsedSeconds: number, observedAtMs: number) => void;
  intervalMs?: number;
};

export type ElapsedSample = {
  elapsedSeconds: number;
  observedAtMs: number;
};

/**
 * Monotonic display scheduler. Browser lifecycle sampling is owned by
 * `useTimerLifecycle`, which calls the returned sampler before reconciling or
 * checkpointing durable state.
 */
export function useElapsedScheduler({
  enabled,
  onElapsed,
  intervalMs = 1_000,
}: ElapsedSchedulerOptions) {
  const callbackRef = useRef(onElapsed);
  const anchorRef = useRef(createClockAnchor());
  const enabledRef = useRef(enabled);

  useEffect(() => {
    callbackRef.current = onElapsed;
  }, [onElapsed]);

  useEffect(() => {
    enabledRef.current = enabled;
    anchorRef.current = createClockAnchor();
  }, [enabled]);

  const sampleAt = useCallback((nowMs = Date.now()): ElapsedSample => {
    if (!enabledRef.current) {
      return { elapsedSeconds: 0, observedAtMs: Math.max(0, nowMs) };
    }
    const batch = advanceClock(anchorRef.current, nowMs);
    anchorRef.current = batch.anchor;
    if (batch.elapsedSeconds > 0) {
      callbackRef.current(batch.elapsedSeconds, batch.anchor.observedAtMs);
    }
    return {
      elapsedSeconds: batch.elapsedSeconds,
      observedAtMs: batch.anchor.observedAtMs,
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const interval = window.setInterval(() => sampleAt(), intervalMs);
    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, intervalMs, sampleAt]);

  return sampleAt;
}
