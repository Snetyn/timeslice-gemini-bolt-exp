import { useEffect } from "react";
import {
  checkpointPersistedTimers,
  reconcileAllTimers,
} from "../data/timerRepository";
import { flushAppStorage } from "../lib/storage";

/** Runs idempotent reconciliation at every PWA/browser lifecycle boundary. */
export function useTimerLifecycle() {
  useEffect(() => {
    let reconciling = false;
    const reconcile = async () => {
      if (reconciling) return;
      reconciling = true;
      try {
        await reconcileAllTimers();
      } finally {
        reconciling = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void reconcile();
      else void flushAppStorage();
    };
    const onPageShow = () => void reconcile();
    const onPageHide = () => {
      void checkpointPersistedTimers();
      void flushAppStorage();
    };
    const onFocus = () => void reconcile();
    void reconcile();
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
  }, []);
}
