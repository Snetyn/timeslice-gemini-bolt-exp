import { useEffect, useRef } from "react";
import {
  checkpointPersistedTimers,
  reconcileAllTimers,
} from "../data/timerRepository";
import { flushAppStorage } from "../lib/storage";
import { useElapsedScheduler } from "./useElapsedScheduler";

type TimerLifecycleOptions = {
  enabled: boolean;
  onElapsed: (elapsedSeconds: number, observedAtMs: number) => void;
  onCheckpoint?: (observedAtMs: number) => void | Promise<void>;
  intervalMs?: number;
};

/**
 * Samples elapsed UI time first, then reconciles or checkpoints every durable
 * timer at that exact observed timestamp.
 */
export function useTimerLifecycle({
  enabled,
  onElapsed,
  onCheckpoint,
  intervalMs,
}: TimerLifecycleOptions) {
  const sampleAt = useElapsedScheduler({ enabled, onElapsed, intervalMs });
  const checkpointRef = useRef(onCheckpoint);

  useEffect(() => {
    checkpointRef.current = onCheckpoint;
  }, [onCheckpoint]);

  useEffect(() => {
    let reconciling = false;
    let checkpointing = false;
    let pendingReconcileAtMs = 0;
    let pendingCheckpointAtMs = 0;
    let activeReconcileAtMs = 0;
    let activeCheckpointAtMs = 0;
    const reconcile = async (observedAtMs: number) => {
      if (
        observedAtMs <= Math.max(activeReconcileAtMs, pendingReconcileAtMs)
      )
        return;
      pendingReconcileAtMs = Math.max(pendingReconcileAtMs, observedAtMs);
      if (reconciling) return;
      reconciling = true;
      try {
        while (pendingReconcileAtMs > 0) {
          const nextObservedAtMs = pendingReconcileAtMs;
          pendingReconcileAtMs = 0;
          activeReconcileAtMs = nextObservedAtMs;
          await reconcileAllTimers(nextObservedAtMs);
          activeReconcileAtMs = 0;
        }
      } finally {
        activeReconcileAtMs = 0;
        reconciling = false;
      }
    };
    const checkpoint = async (observedAtMs: number) => {
      if (
        observedAtMs <= Math.max(activeCheckpointAtMs, pendingCheckpointAtMs)
      )
        return;
      pendingCheckpointAtMs = Math.max(pendingCheckpointAtMs, observedAtMs);
      if (checkpointing) return;
      checkpointing = true;
      try {
        while (pendingCheckpointAtMs > 0) {
          const nextObservedAtMs = pendingCheckpointAtMs;
          pendingCheckpointAtMs = 0;
          activeCheckpointAtMs = nextObservedAtMs;
          await checkpointPersistedTimers(nextObservedAtMs);
          await checkpointRef.current?.(nextObservedAtMs);
          await flushAppStorage();
          activeCheckpointAtMs = 0;
        }
      } finally {
        activeCheckpointAtMs = 0;
        checkpointing = false;
      }
    };
    const sample = () => sampleAt(Date.now()).observedAtMs;
    const onVisible = () => {
      const observedAtMs = sample();
      if (document.visibilityState === "visible") {
        void reconcile(observedAtMs);
      } else {
        void checkpoint(observedAtMs);
      }
    };
    const onPageShow = () => void reconcile(sample());
    const onPageHide = () => void checkpoint(sample());
    const onFocus = () => void reconcile(sample());
    void reconcile(sample());
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onFocus);
    };
  }, [sampleAt]);
}
