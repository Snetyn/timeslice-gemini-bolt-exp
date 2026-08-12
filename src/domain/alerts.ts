export type AlertMode = "session" | "daily" | "free-flow" | "flow-break";

export type AlertChannel = "visual" | "sound" | "vibration" | "speech";

export type AlertEventType =
  | "activity-complete"
  | "session-complete"
  | "break-complete"
  | "overtime-start"
  | "quick-reserve-full"
  | "remaining-checkpoint"
  | "elapsed-interval"
  | "overtime-interval"
  | "scheduled-task-due";

export type AlertTone = "soft" | "clear" | "urgent";

export type AlertTimerStatus =
  "idle" | "running" | "paused" | "completed" | "overtime";

export type AlertTimerSnapshot = {
  timerKey: string;
  mode: AlertMode;
  status: AlertTimerStatus;
  activityId?: string;
  activityName?: string;
  observedAtMs: number;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  overtimeSeconds: number;
  quickReserveFull?: boolean;
  scheduledTaskDue?: boolean;
  completionScope?: "activity" | "session" | "break";
};

export type SpeechProfile = {
  enabled: boolean;
  voiceURI: string | null;
  language: string;
  rate: number;
  pitch: number;
  volume: number;
  includeActivityName: boolean;
  remainingCheckpointsSeconds: number[];
  elapsedIntervalSeconds: number | null;
  overtimeIntervalSeconds: number | null;
};

export type AlertPreferences = {
  enabled: boolean;
  channels: Record<AlertChannel, boolean>;
  events: Record<AlertEventType, boolean>;
  tone: AlertTone;
  speech: SpeechProfile;
  speechOverrides: Partial<Record<AlertMode, Partial<SpeechProfile>>>;
};

export type AlertEvent = {
  id: string;
  type: AlertEventType;
  timerKey: string;
  mode: AlertMode;
  occurredAtMs: number;
  activityId?: string;
  activityName?: string;
  valueSeconds?: number;
  priority: 1 | 2 | 3 | 4;
};

export type AlertCursor = {
  timerKey: string;
  snapshot: AlertTimerSnapshot;
  scheduleSignature: string;
  deliveredEventIds: string[];
  updatedAtMs: number;
};

const EVENT_TYPES: AlertEventType[] = [
  "activity-complete",
  "session-complete",
  "break-complete",
  "overtime-start",
  "quick-reserve-full",
  "remaining-checkpoint",
  "elapsed-interval",
  "overtime-interval",
  "scheduled-task-due",
];

export const DEFAULT_SPEECH_PROFILE: SpeechProfile = {
  enabled: false,
  voiceURI: null,
  language: "",
  rate: 1,
  pitch: 1,
  volume: 1,
  includeActivityName: true,
  remainingCheckpointsSeconds: [],
  elapsedIntervalSeconds: null,
  overtimeIntervalSeconds: null,
};

export const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  enabled: false,
  channels: {
    visual: false,
    sound: false,
    vibration: false,
    speech: false,
  },
  events: Object.fromEntries(
    EVENT_TYPES.map((type) => [type, false]),
  ) as Record<AlertEventType, boolean>,
  tone: "clear",
  speech: DEFAULT_SPEECH_PROFILE,
  speechOverrides: {},
};

const recordOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const bounded = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
};

const secondsOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
};

export function normalizeCheckpointSeconds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(Number)
        .filter((seconds) => Number.isFinite(seconds) && seconds > 0)
        .map(Math.floor),
    ),
  ].sort((left, right) => right - left);
}

export function parseAlertClock(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length > 2 || parts.some((part) => !/^\d+$/.test(part)))
    return null;
  const minutes = Number(parts.length === 2 ? parts[0] : parts[0]);
  const seconds = parts.length === 2 ? Number(parts[1]) : 0;
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59)
    return null;
  const total = Math.floor(minutes * 60 + seconds);
  return total > 0 ? total : null;
}

export function formatAlertClock(value: number | null) {
  if (!value) return "";
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function normalizeSpeechProfile(
  value: unknown,
  fallback: SpeechProfile = DEFAULT_SPEECH_PROFILE,
): SpeechProfile {
  const record = recordOf(value);
  return {
    enabled:
      typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
    voiceURI:
      typeof record.voiceURI === "string" && record.voiceURI.trim()
        ? record.voiceURI.trim()
        : fallback.voiceURI,
    language:
      typeof record.language === "string"
        ? record.language.trim()
        : fallback.language,
    rate: bounded(record.rate, fallback.rate, 0.5, 2),
    pitch: bounded(record.pitch, fallback.pitch, 0.5, 2),
    volume: bounded(record.volume, fallback.volume, 0, 1),
    includeActivityName:
      typeof record.includeActivityName === "boolean"
        ? record.includeActivityName
        : fallback.includeActivityName,
    remainingCheckpointsSeconds:
      record.remainingCheckpointsSeconds === undefined
        ? fallback.remainingCheckpointsSeconds
        : normalizeCheckpointSeconds(record.remainingCheckpointsSeconds),
    elapsedIntervalSeconds:
      record.elapsedIntervalSeconds === undefined
        ? fallback.elapsedIntervalSeconds
        : secondsOrNull(record.elapsedIntervalSeconds),
    overtimeIntervalSeconds:
      record.overtimeIntervalSeconds === undefined
        ? fallback.overtimeIntervalSeconds
        : secondsOrNull(record.overtimeIntervalSeconds),
  };
}

export function normalizeAlertPreferences(value: unknown): AlertPreferences {
  const record = recordOf(value);
  const channels = recordOf(record.channels);
  const events = recordOf(record.events);
  const overrides = recordOf(record.speechOverrides);
  const speechOverrides: AlertPreferences["speechOverrides"] = {};
  (["session", "daily", "free-flow", "flow-break"] as AlertMode[]).forEach(
    (mode) => {
      if (overrides[mode] && typeof overrides[mode] === "object") {
        speechOverrides[mode] = normalizeSpeechProfile(
          overrides[mode],
          normalizeSpeechProfile(record.speech),
        );
      }
    },
  );
  return {
    enabled: Boolean(record.enabled),
    channels: {
      visual: channels.visual === true,
      sound: channels.sound === true,
      vibration: channels.vibration === true,
      speech: channels.speech === true,
    },
    events: Object.fromEntries(
      EVENT_TYPES.map((type) => [type, Boolean(events[type])]),
    ) as Record<AlertEventType, boolean>,
    tone:
      record.tone === "soft" || record.tone === "urgent"
        ? record.tone
        : "clear",
    speech: normalizeSpeechProfile(record.speech),
    speechOverrides,
  };
}

export function resolveSpeechProfile(
  preferences: AlertPreferences,
  mode: AlertMode,
) {
  return normalizeSpeechProfile(
    preferences.speechOverrides[mode],
    preferences.speech,
  );
}

export function alertScheduleSignature(
  preferences: AlertPreferences,
  mode: AlertMode,
) {
  const profile = resolveSpeechProfile(preferences, mode);
  return JSON.stringify({
    enabled: preferences.enabled,
    events: preferences.events,
    profile: {
      enabled: profile.enabled,
      remaining: profile.remainingCheckpointsSeconds,
      elapsed: profile.elapsedIntervalSeconds,
      overtime: profile.overtimeIntervalSeconds,
    },
  });
}

const priorityFor = (type: AlertEventType): AlertEvent["priority"] => {
  if (
    type === "activity-complete" ||
    type === "session-complete" ||
    type === "break-complete"
  )
    return 4;
  if (type === "overtime-start" || type === "scheduled-task-due") return 3;
  if (type === "remaining-checkpoint" || type === "quick-reserve-full")
    return 2;
  return 1;
};

const eventId = (
  snapshot: AlertTimerSnapshot,
  type: AlertEventType,
  valueSeconds?: number,
) => [snapshot.timerKey, type, valueSeconds ?? "once"].join(":");

function makeEvent(
  snapshot: AlertTimerSnapshot,
  type: AlertEventType,
  valueSeconds?: number,
): AlertEvent {
  return {
    id: eventId(snapshot, type, valueSeconds),
    type,
    timerKey: snapshot.timerKey,
    mode: snapshot.mode,
    occurredAtMs: snapshot.observedAtMs,
    activityId: snapshot.activityId,
    activityName: snapshot.activityName,
    valueSeconds,
    priority: priorityFor(type),
  };
}

const crossedInterval = (
  previous: number,
  current: number,
  interval: number,
) => {
  if (interval <= 0 || current <= previous) return null;
  const previousBucket = Math.floor(previous / interval);
  const currentBucket = Math.floor(current / interval);
  return currentBucket > previousBucket ? currentBucket * interval : null;
};

export function collectAlertEvents(input: {
  previous: AlertTimerSnapshot | null;
  current: AlertTimerSnapshot;
  preferences: AlertPreferences;
  visible: boolean;
  deliveredEventIds?: Iterable<string>;
}): AlertEvent[] {
  const { previous, current, preferences, visible } = input;
  if (!preferences.enabled || !previous || !visible) return [];
  if (previous.timerKey !== current.timerKey) return [];
  const delivered = new Set(input.deliveredEventIds || []);
  const events: AlertEvent[] = [];
  const add = (type: AlertEventType, valueSeconds?: number) => {
    if (!preferences.events[type]) return;
    const event = makeEvent(current, type, valueSeconds);
    if (!delivered.has(event.id)) events.push(event);
  };

  if (previous.status !== "completed" && current.status === "completed") {
    add(
      current.completionScope === "session"
        ? "session-complete"
        : current.completionScope === "break"
          ? "break-complete"
          : "activity-complete",
    );
  }
  if (previous.overtimeSeconds <= 0 && current.overtimeSeconds > 0) {
    add("overtime-start");
  }
  if (!previous.quickReserveFull && current.quickReserveFull) {
    add("quick-reserve-full");
  }
  if (!previous.scheduledTaskDue && current.scheduledTaskDue) {
    add("scheduled-task-due");
  }

  const profile = resolveSpeechProfile(preferences, current.mode);
  if (
    profile.enabled &&
    previous.remainingSeconds !== null &&
    current.remainingSeconds !== null &&
    current.remainingSeconds <= previous.remainingSeconds
  ) {
    profile.remainingCheckpointsSeconds.forEach((checkpoint) => {
      if (
        previous.remainingSeconds! > checkpoint &&
        current.remainingSeconds! <= checkpoint
      ) {
        add("remaining-checkpoint", checkpoint);
      }
    });
  }
  if (profile.enabled && profile.elapsedIntervalSeconds) {
    const crossed = crossedInterval(
      previous.elapsedSeconds,
      current.elapsedSeconds,
      profile.elapsedIntervalSeconds,
    );
    if (crossed !== null) add("elapsed-interval", crossed);
  }
  if (profile.enabled && profile.overtimeIntervalSeconds) {
    const crossed = crossedInterval(
      previous.overtimeSeconds,
      current.overtimeSeconds,
      profile.overtimeIntervalSeconds,
    );
    if (crossed !== null) add("overtime-interval", crossed);
  }
  return events.sort((left, right) => right.priority - left.priority);
}
