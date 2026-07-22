import { useEffect, useRef } from "react";
import { advanceClock, createClockAnchor } from "../domain/clock";

type ElapsedSchedulerOptions = {
  enabled: boolean;
  onElapsed: (elapsedSeconds: number, observedAtMs: number) => void;
  intervalMs?: number;
};

/**
 * One scheduler for live rendering and every browser/PWA lifecycle boundary.
 * Its callback receives a whole-second batch exactly once for each wall-clock
 * period; rerenders never recreate its anchor.
 */
export function useElapsedScheduler({
  enabled,
  onElapsed,
  intervalMs = 1_000,
}: ElapsedSchedulerOptions) {
  const callbackRef = useRef(onElapsed);
  const anchorRef = useRef(createClockAnchor());

  useEffect(() => {
    callbackRef.current = onElapsed;
  }, [onElapsed]);

  useEffect(() => {
    if (!enabled) {
      anchorRef.current = createClockAnchor();
      return;
    }

    anchorRef.current = createClockAnchor();
    const sample = () => {
      const batch = advanceClock(anchorRef.current);
      anchorRef.current = batch.anchor;
      if (batch.elapsedSeconds > 0) {
        callbackRef.current(batch.elapsedSeconds, batch.anchor.observedAtMs);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") sample();
    };
    const onBoundary = () => sample();

    const interval = window.setInterval(sample, intervalMs);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onBoundary);
    window.addEventListener("pagehide", onBoundary, { capture: true });
    window.addEventListener("focus", onBoundary);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onBoundary);
      window.removeEventListener("pagehide", onBoundary, { capture: true });
      window.removeEventListener("focus", onBoundary);
    };
  }, [enabled, intervalMs]);
}
