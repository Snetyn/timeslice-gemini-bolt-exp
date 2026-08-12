import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALERT_PREFERENCES,
  collectAlertEvents,
  formatAlertClock,
  normalizeAlertPreferences,
  parseAlertClock,
  type AlertPreferences,
  type AlertTimerSnapshot,
} from "./alerts";

const preferences = (
  patch: Partial<AlertPreferences> = {},
): AlertPreferences => ({
  ...DEFAULT_ALERT_PREFERENCES,
  enabled: true,
  events: {
    ...DEFAULT_ALERT_PREFERENCES.events,
    "activity-complete": true,
    "remaining-checkpoint": true,
    "elapsed-interval": true,
    "overtime-start": true,
  },
  speech: {
    ...DEFAULT_ALERT_PREFERENCES.speech,
    enabled: true,
    remainingCheckpointsSeconds: [600, 150, 60],
    elapsedIntervalSeconds: 300,
  },
  ...patch,
});

const snapshot = (
  patch: Partial<AlertTimerSnapshot> = {},
): AlertTimerSnapshot => ({
  timerKey: "session:focus",
  mode: "session",
  status: "running",
  activityName: "Focus",
  observedAtMs: 1_000,
  elapsedSeconds: 0,
  remainingSeconds: 900,
  overtimeSeconds: 0,
  ...patch,
});

describe("alert domain", () => {
  it("parses and formats custom minute-second values", () => {
    expect(parseAlertClock("2:30")).toBe(150);
    expect(parseAlertClock("15")).toBe(900);
    expect(parseAlertClock("0:20")).toBe(20);
    expect(parseAlertClock("2:75")).toBeNull();
    expect(parseAlertClock("0:00")).toBeNull();
    expect(formatAlertClock(150)).toBe("2:30");
  });

  it("normalizes malformed opt-in settings to safe disabled values", () => {
    const normalized = normalizeAlertPreferences({
      enabled: true,
      channels: { sound: "yes", speech: true },
      speech: {
        enabled: true,
        rate: 99,
        pitch: -1,
        remainingCheckpointsSeconds: [60, 60, -2, "120"],
      },
    });
    expect(normalized.channels.sound).toBe(false);
    expect(normalized.channels.speech).toBe(true);
    expect(normalized.speech.rate).toBe(2);
    expect(normalized.speech.pitch).toBe(0.5);
    expect(normalized.speech.remainingCheckpointsSeconds).toEqual([120, 60]);
  });

  it("emits every crossed custom checkpoint once in priority order", () => {
    const current = snapshot({
      observedAtMs: 2_000,
      elapsedSeconds: 780,
      remainingSeconds: 120,
    });
    const events = collectAlertEvents({
      previous: snapshot({ elapsedSeconds: 240, remainingSeconds: 700 }),
      current,
      preferences: preferences(),
      visible: true,
    });
    expect(events.map((event) => [event.type, event.valueSeconds])).toEqual([
      ["remaining-checkpoint", 600],
      ["remaining-checkpoint", 150],
      ["elapsed-interval", 600],
    ]);
    expect(
      collectAlertEvents({
        previous: current,
        current,
        preferences: preferences(),
        visible: true,
      }),
    ).toEqual([]);
  });

  it("does not replay crossed checkpoints while hidden", () => {
    expect(
      collectAlertEvents({
        previous: snapshot({ remainingSeconds: 700 }),
        current: snapshot({ remainingSeconds: 30 }),
        preferences: preferences(),
        visible: false,
      }),
    ).toEqual([]);
  });

  it("emits completion and overtime transitions without duplication", () => {
    const complete = collectAlertEvents({
      previous: snapshot(),
      current: snapshot({ status: "completed", completionScope: "activity" }),
      preferences: preferences(),
      visible: true,
    });
    expect(complete.map((event) => event.type)).toEqual(["activity-complete"]);
    const overtime = collectAlertEvents({
      previous: snapshot({ remainingSeconds: 1 }),
      current: snapshot({
        status: "overtime",
        remainingSeconds: 0,
        overtimeSeconds: 1,
      }),
      preferences: preferences(),
      visible: true,
    });
    expect(overtime.map((event) => event.type)).toEqual(["overtime-start"]);
  });

  it("honors delivered event identifiers after lifecycle replay", () => {
    const current = snapshot({ status: "completed" });
    const first = collectAlertEvents({
      previous: snapshot(),
      current,
      preferences: preferences(),
      visible: true,
    });
    expect(first).toHaveLength(1);
    expect(
      collectAlertEvents({
        previous: snapshot(),
        current,
        preferences: preferences(),
        visible: true,
        deliveredEventIds: [first[0].id],
      }),
    ).toEqual([]);
  });
});
