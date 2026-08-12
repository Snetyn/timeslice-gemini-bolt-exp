import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  alertScheduleSignature,
  collectAlertEvents,
  normalizeAlertPreferences,
  resolveSpeechProfile,
  type AlertCursor,
  type AlertEvent,
  type AlertPreferences,
  type AlertTimerSnapshot,
} from "../domain/alerts";
import { getAlertCursor, saveAlertCursor } from "../data/alertRepository";
import {
  AlertDispatcher,
  createBrowserAlertPlatform,
  type AlertSupport,
} from "../services/alertDispatcher";

type CursorState = Pick<
  AlertCursor,
  "snapshot" | "scheduleSignature" | "deliveredEventIds"
>;

type TimerAlertsOptions = {
  snapshots: AlertTimerSnapshot[];
  preferences: unknown;
  onVisualAlert: (event: AlertEvent, text: string) => void;
};

export function useTimerAlerts({
  snapshots,
  preferences: rawPreferences,
  onVisualAlert,
}: TimerAlertsOptions) {
  const preferences = useMemo(
    () => normalizeAlertPreferences(rawPreferences),
    [rawPreferences],
  );
  const platform = useMemo(() => createBrowserAlertPlatform(), []);
  const visualRef = useRef(onVisualAlert);
  const dispatcherRef = useRef<AlertDispatcher | null>(null);
  const cursorRef = useRef(new Map<string, CursorState>());
  const hydratedRef = useRef(new Set<string>());
  const [support] = useState<AlertSupport>(platform.support);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    platform.voices(),
  );

  useEffect(() => {
    visualRef.current = onVisualAlert;
  }, [onVisualAlert]);

  if (!dispatcherRef.current) {
    dispatcherRef.current = new AlertDispatcher(platform, (event, text) =>
      visualRef.current(event, text),
    );
  }

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const refresh = () => setVoices(platform.voices());
    refresh();
    window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
    return () =>
      window.speechSynthesis.removeEventListener?.("voiceschanged", refresh);
  }, [platform]);

  useEffect(() => {
    snapshots.forEach((snapshot) => {
      if (hydratedRef.current.has(snapshot.timerKey)) return;
      hydratedRef.current.add(snapshot.timerKey);
      void getAlertCursor(snapshot.timerKey)
        .then((stored) => {
          const signature = alertScheduleSignature(preferences, snapshot.mode);
          cursorRef.current.set(snapshot.timerKey, {
            // Always baseline at the live value: foreground reloads never replay
            // speech, sound, or vibration for time crossed while the app was away.
            snapshot,
            scheduleSignature: signature,
            deliveredEventIds:
              stored?.scheduleSignature === signature
                ? stored.deliveredEventIds
                : [],
          });
        })
        .catch(() => {
          cursorRef.current.set(snapshot.timerKey, {
            snapshot,
            scheduleSignature: alertScheduleSignature(
              preferences,
              snapshot.mode,
            ),
            deliveredEventIds: [],
          });
        });
    });
  }, [preferences, snapshots]);

  useEffect(() => {
    const currentKeys = new Set(snapshots.map((snapshot) => snapshot.timerKey));
    snapshots.forEach((snapshot) => {
      const signature = alertScheduleSignature(preferences, snapshot.mode);
      const cursor = cursorRef.current.get(snapshot.timerKey);
      if (!cursor || cursor.scheduleSignature !== signature) {
        cursorRef.current.set(snapshot.timerKey, {
          snapshot,
          scheduleSignature: signature,
          deliveredEventIds: [],
        });
        return;
      }
      const restarted =
        ((cursor.snapshot.status === "completed" ||
          cursor.snapshot.status === "idle") &&
          (snapshot.status === "running" || snapshot.status === "overtime")) ||
        snapshot.elapsedSeconds < cursor.snapshot.elapsedSeconds ||
        (snapshot.remainingSeconds !== null &&
          cursor.snapshot.remainingSeconds !== null &&
          snapshot.remainingSeconds > cursor.snapshot.remainingSeconds + 1);
      if (restarted) {
        cursorRef.current.set(snapshot.timerKey, {
          snapshot,
          scheduleSignature: signature,
          deliveredEventIds: [],
        });
        return;
      }
      const visible = document.visibilityState === "visible";
      const events = collectAlertEvents({
        previous: cursor.snapshot,
        current: snapshot,
        preferences,
        visible,
        deliveredEventIds: cursor.deliveredEventIds,
      });
      const deliveredEventIds = [
        ...cursor.deliveredEventIds,
        ...events.map((event) => event.id),
      ].slice(-64);
      cursorRef.current.set(snapshot.timerKey, {
        snapshot,
        scheduleSignature: signature,
        deliveredEventIds,
      });
      if (events.length > 0) {
        void events.reduce(
          (chain, event) =>
            chain.then(() =>
              dispatcherRef.current!.deliver(event, preferences),
            ),
          Promise.resolve(),
        );
        void saveAlertCursor(
          snapshot,
          preferences,
          deliveredEventIds,
          `alerts:event:${snapshot.timerKey}:${events.map((event) => event.id).join("|")}`,
        );
      }
    });
    [...cursorRef.current.keys()].forEach((key) => {
      if (!currentKeys.has(key)) cursorRef.current.delete(key);
    });
  }, [preferences, snapshots]);

  useEffect(() => {
    const checkpoint = () => {
      if (document.visibilityState !== "hidden") return;
      cursorRef.current.forEach((cursor, timerKey) => {
        void saveAlertCursor(
          cursor.snapshot,
          preferences,
          cursor.deliveredEventIds,
          `alerts:hidden:${timerKey}:${cursor.snapshot.observedAtMs}`,
        );
      });
      dispatcherRef.current?.cancelSpeech();
    };
    document.addEventListener("visibilitychange", checkpoint);
    window.addEventListener("pagehide", checkpoint);
    return () => {
      document.removeEventListener("visibilitychange", checkpoint);
      window.removeEventListener("pagehide", checkpoint);
    };
  }, [preferences]);

  const testSound = useCallback(
    (tone = preferences.tone) => platform.playTone(tone, 2),
    [platform, preferences.tone],
  );
  const testVibration = useCallback(
    () => platform.vibrate([120, 70, 120]),
    [platform],
  );
  const testSpeech = useCallback(
    (mode: AlertTimerSnapshot["mode"] = "session") => {
      const profile = resolveSpeechProfile(preferences, mode);
      platform.cancelSpeech();
      platform.speak({
        text: profile.includeActivityName
          ? "TimeSlice, voice preview"
          : "Voice preview",
        profile: { ...profile, enabled: true },
      });
    },
    [platform, preferences],
  );

  return { support, voices, testSound, testVibration, testSpeech };
}
