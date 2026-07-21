import { STORAGE_KEY } from "../lib/storage";
import type { TimerState } from "../domain/timer";
import {
  timeSliceDb,
  transact,
  type TimeSliceDatabase,
  type VersionedRecord,
} from "./timesliceDb";

export const COMPATIBILITY_KEYS = [
  "timeSliceActivities",
  "timeSliceTotalHours",
  "timeSliceTotalMinutes",
  "timeSliceSessionState",
  "timeSliceSettings",
  "timeSliceDailyActivities",
  "timeSliceActiveDailyActivity",
  "timeSliceSingleActivityState",
  "timeSliceRPGTags",
  "timeSliceActivityTemplates",
  "timeSliceCustomCategories",
  "timeSliceCustomTags",
  "timeSliceFlowmodoro",
  "timeSliceDailyActivitiesDate",
  "flowLastWorkTs",
] as const;

type LegacyEnvelope = { version?: unknown; values?: Record<string, unknown> };

const IMPORT_META_ID = "legacy-import-v1";
const BACKUP_META_ID = "legacy-import-v1-raw";

const ROUTES: Record<
  string,
  {
    table:
      | "settings"
      | "sessionActivities"
      | "dailyActivities"
      | "tags"
      | "templates"
      | "categories"
      | "counters";
    id: string;
  }
> = {
  timeSliceActivities: { table: "sessionActivities", id: "all" },
  timeSliceSettings: { table: "settings", id: "current" },
  timeSliceDailyActivities: { table: "dailyActivities", id: "all" },
  timeSliceRPGTags: { table: "tags", id: "rpg" },
  timeSliceCustomTags: { table: "tags", id: "custom" },
  timeSliceActivityTemplates: { table: "templates", id: "all" },
  timeSliceCustomCategories: { table: "categories", id: "all" },
  timeSliceTotalHours: { table: "counters", id: "total-hours" },
  timeSliceTotalMinutes: { table: "counters", id: "total-minutes" },
};

const readLegacySnapshot = () => {
  const values: Record<string, string> = {};
  const raw: Record<string, string | null> = {};
  if (typeof window === "undefined") return { values, raw };

  const envelopeRaw = window.localStorage.getItem(STORAGE_KEY);
  raw[STORAGE_KEY] = envelopeRaw;
  try {
    const envelope = JSON.parse(envelopeRaw || "{}") as LegacyEnvelope;
    if (
      envelope.version === 2 &&
      envelope.values &&
      typeof envelope.values === "object"
    ) {
      for (const [key, value] of Object.entries(envelope.values)) {
        if (typeof value === "string") values[key] = value;
      }
    }
  } catch {
    // A malformed old envelope is retained in the backup but must not block boot.
  }

  for (const key of COMPATIBILITY_KEYS) {
    const legacy = window.localStorage.getItem(key);
    raw[key] = legacy;
    if (!(key in values) && legacy !== null) values[key] = legacy;
  }
  return { values, raw };
};

const isSafeSerializedValue = (value: string) => {
  if (value.length > 5_000_000) return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    // `flowLastWorkTs` is intentionally a scalar rather than JSON.
    return /^\d+$/.test(value);
  }
};

const parseValue = <T>(value?: string): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const asTimestamp = (value: unknown, fallback: number) => {
  const timestamp = new Date(value as string | number).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
};

const migratedTimers = (
  values: Record<string, string>,
  now: number,
): TimerState[] => {
  const timers: TimerState[] = [];
  const session = parseValue<{ isTimerActive?: boolean; isPaused?: boolean }>(
    values.timeSliceSessionState,
  );
  if (session?.isTimerActive) {
    // Old activity progress and timestamp were not atomically saved. Keep the
    // visible snapshot as truth and begin a fresh running anchor at migration.
    timers.push({
      id: "session",
      status: session.isPaused ? "paused" : "running",
      startedAtMs: session.isPaused ? null : now,
      accumulatedMs: 0,
      targetDurationMs: null,
      endAtMs: null,
      revision: 1,
      updatedAtMs: now,
      lastObservedAtMs: now,
    });
  }

  const single = parseValue<{
    isActive?: boolean;
    startTime?: string | number;
    elapsedSeconds?: number;
  }>(values.timeSliceSingleActivityState);
  if (single?.isActive) {
    const startedAtMs = asTimestamp(single.startTime, now);
    timers.push({
      id: "single",
      status: "running",
      startedAtMs,
      accumulatedMs: 0,
      targetDurationMs: null,
      endAtMs: null,
      revision: 1,
      updatedAtMs: now,
      lastObservedAtMs: Math.max(now, startedAtMs),
    });
  }

  const daily =
    parseValue<
      Array<{
        id?: string;
        isActive?: boolean;
        startedAt?: string | number;
        timeSpent?: number;
      }>
    >(values.timeSliceDailyActivities) || [];
  daily
    .filter((item) => item.isActive && item.id)
    .forEach((item) => {
      const startedAtMs = asTimestamp(item.startedAt, now);
      timers.push({
        id: `daily:${item.id}`,
        status: "running",
        startedAtMs,
        accumulatedMs: Math.max(0, Number(item.timeSpent) || 0) * 60_000,
        targetDurationMs: null,
        endAtMs: null,
        revision: 1,
        updatedAtMs: now,
        lastObservedAtMs: Math.max(now, startedAtMs),
      });
    });

  const flow = parseValue<{ isOnBreak?: boolean; breakTimeRemaining?: number }>(
    values.timeSliceFlowmodoro,
  );
  if (flow?.isOnBreak && Number(flow.breakTimeRemaining) > 0) {
    const targetDurationMs =
      Math.max(0, Number(flow.breakTimeRemaining)) * 1_000;
    timers.push({
      id: "flowmodoro-break",
      status: "running",
      startedAtMs: now,
      accumulatedMs: 0,
      targetDurationMs,
      endAtMs: now + targetDurationMs,
      revision: 1,
      updatedAtMs: now,
      lastObservedAtMs: now,
    });
  }
  return timers;
};

/**
 * One-way *copy* migration. Browser localStorage is never changed, so a user
 * can still manually return to an older build if necessary.
 */
export async function migrateLegacyStorage(
  db: TimeSliceDatabase = timeSliceDb,
) {
  if (await db.meta.get(IMPORT_META_ID)) return false;
  const snapshot = readLegacySnapshot();
  const now = Date.now();

  await transact(
    [
      "compatibility",
      "settings",
      "sessionActivities",
      "dailyActivities",
      "tags",
      "templates",
      "categories",
      "counters",
      "timers",
    ],
    async (revision) => {
      const records: VersionedRecord<string>[] = Object.entries(snapshot.values)
        .filter(([, value]) => isSafeSerializedValue(value))
        .map(([id, value]) => ({ id, value, revision, updatedAtMs: now }));
      if (records.length) await db.compatibility.bulkPut(records);
      for (const record of records) {
        const route = ROUTES[record.id];
        if (route) await db[route.table].put({ ...record, id: route.id });
      }
      const timers = migratedTimers(snapshot.values, now);
      if (timers.length) {
        await db.timers.bulkPut(
          timers.map((value) => ({
            id: value.id,
            value,
            revision,
            updatedAtMs: now,
          })),
        );
      }
      await db.meta.put({
        id: BACKUP_META_ID,
        value: snapshot.raw,
        revision,
        updatedAtMs: now,
      });
      await db.meta.put({
        id: IMPORT_META_ID,
        value: {
          completedAtMs: now,
          importedKeys: records.map((record) => record.id),
        },
        revision,
        updatedAtMs: now,
      });
    },
    db,
  );
  return true;
}

export async function loadCompatibilityValues(
  db: TimeSliceDatabase = timeSliceDb,
) {
  const records = await db.compatibility.toArray();
  return Object.fromEntries(records.map((record) => [record.id, record.value]));
}
