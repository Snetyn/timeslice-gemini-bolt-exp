import {
  loadCompatibilityValues,
  migrateLegacyStorage,
} from "../data/migrateLegacy";
import {
  timeSliceDb,
  transact,
  type VersionedRecord,
} from "../data/timesliceDb";
import { timerController } from "./controller";
import { normalizePersistedSessionRun } from "../domain/sessionSnapshot";

export const STORAGE_KEY = "timeslice.state.v2";

type RoutedTable =
  | "settings"
  | "sessionActivities"
  | "dailyActivities"
  | "tags"
  | "templates"
  | "categories"
  | "counters";

const ROUTES: Record<string, { table: RoutedTable; id: string }> = {
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

// Existing UI calls this synchronous facade. Its source is now an IndexedDB
// cache hydrated before React mounts, never browser localStorage.
let cache: Record<string, string> = {};
let hydrated = false;
let flushPromise: Promise<void> | null = null;
let flushTimer: number | undefined;
const changed = new Set<string>();
const listeners = new Set<() => void>();
const externalListeners = new Set<(keys: string[]) => void>();
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("timeslice-state");

const VOLATILE_KEYS = new Set(["timeSliceActivities", "timeSliceFlowmodoro"]);

const emit = () => listeners.forEach((listener) => listener());

channel?.addEventListener(
  "message",
  async (event: MessageEvent<{ type?: string; keys?: string[] }>) => {
    if (event.data?.type !== "state-changed" || !event.data.keys?.length)
      return;
    const records = await timeSliceDb.compatibility.bulkGet(event.data.keys);
    event.data.keys.forEach((key, index) => {
      const record = records[index];
      if (record) cache[key] = record.value;
      else delete cache[key];
    });
    emit();
    externalListeners.forEach((listener) => listener(event.data.keys || []));
  },
);

export async function hydrateAppStorage() {
  if (hydrated) return;
  await timeSliceDb.open();
  await migrateLegacyStorage();
  cache = await loadCompatibilityValues();
  const sessionRunRecord = await timeSliceDb.sessionRuns.get("current");
  const sessionRun = normalizePersistedSessionRun(sessionRunRecord?.value);
  const snapshot = sessionRun?.snapshot;
  if (sessionRun && snapshot && snapshot.status !== "idle") {
    cache.timeSliceActivities = JSON.stringify(sessionRun.activities);
    cache.timeSliceSessionState = JSON.stringify(snapshot);
    if (sessionRun.flowmodoroState !== undefined) {
      cache.timeSliceFlowmodoro = JSON.stringify(
        sessionRun.flowmodoroState,
      );
    }
  }
  hydrated = true;
}

async function persistChanges() {
  if (!changed.size) return;
  const keys = [...changed];
  changed.clear();
  const now = Date.now();
  await transact(
    [
      "compatibility",
      ...(Array.from(
        new Set(keys.map((key) => ROUTES[key]?.table).filter(Boolean)),
      ) as RoutedTable[]),
    ],
    async (revision) => {
      const compatibility: VersionedRecord<string>[] = [];
      for (const key of keys) {
        const value = cache[key];
        if (value === undefined) {
          await timeSliceDb.compatibility.delete(key);
          const route = ROUTES[key];
          if (route) await timeSliceDb[route.table].delete(route.id);
          continue;
        }
        const record = { id: key, value, revision, updatedAtMs: now };
        compatibility.push(record);
        const route = ROUTES[key];
        if (route)
          await timeSliceDb[route.table].put({ ...record, id: route.id });
      }
      if (compatibility.length)
        await timeSliceDb.compatibility.bulkPut(compatibility);
    },
  );
  channel?.postMessage({ type: "state-changed", keys });
}

export async function flushAppStorage() {
  if (flushTimer !== undefined) {
    window.clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (!flushPromise) {
    flushPromise = persistChanges().finally(() => {
      flushPromise = null;
      if (changed.size) void flushAppStorage();
    });
  }
  await flushPromise;
}

const scheduleFlush = (key: string) => {
  if (VOLATILE_KEYS.has(key)) {
    if (flushTimer !== undefined) window.clearTimeout(flushTimer);
    // Continuous rendering keeps moving this deadline; the value is instead
    // committed at a lifecycle boundary or a semantic timer transition.
    flushTimer = window.setTimeout(() => void flushAppStorage(), 1_500);
    return;
  }
  void flushAppStorage();
};

export const appStorage = {
  getItem(key: string): string | null {
    return cache[key] ?? null;
  },

  setItem(key: string, value: string) {
    if (!timerController.getSnapshot().isController) return;
    cache[key] = String(value);
    changed.add(key);
    scheduleFlush(key);
    emit();
  },

  removeItem(key: string) {
    if (!timerController.getSnapshot().isController) return;
    delete cache[key];
    changed.add(key);
    void flushAppStorage();
    emit();
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  subscribeExternal(listener: (keys: string[]) => void) {
    externalListeners.add(listener);
    return () => {
      externalListeners.delete(listener);
    };
  },

  get hydrated() {
    return hydrated;
  },
};

export async function resetAppStorageForTests() {
  cache = {};
  changed.clear();
  hydrated = false;
  if (flushTimer !== undefined) window.clearTimeout(flushTimer);
  flushTimer = undefined;
  timeSliceDb.close();
  await timeSliceDb.delete();
}
