import {
  alertScheduleSignature,
  type AlertCursor,
  type AlertPreferences,
  type AlertTimerSnapshot,
} from "../domain/alerts";
import { timeSliceDb, transactIdempotent } from "./timesliceDb";

const cursorId = (timerKey: string) => `alerts:cursor:${timerKey}`;

const isCursor = (value: unknown): value is AlertCursor => {
  if (!value || typeof value !== "object") return false;
  const cursor = value as Partial<AlertCursor>;
  return (
    typeof cursor.timerKey === "string" &&
    Boolean(cursor.snapshot) &&
    typeof cursor.scheduleSignature === "string" &&
    Array.isArray(cursor.deliveredEventIds) &&
    Number.isFinite(cursor.updatedAtMs)
  );
};

export async function getAlertCursor(timerKey: string) {
  const record = await timeSliceDb.meta.get(cursorId(timerKey));
  return isCursor(record?.value) ? record.value : null;
}

export async function saveAlertCursor(
  snapshot: AlertTimerSnapshot,
  preferences: AlertPreferences,
  deliveredEventIds: string[],
  mutationId: string = crypto.randomUUID(),
) {
  const value: AlertCursor = {
    timerKey: snapshot.timerKey,
    snapshot,
    scheduleSignature: alertScheduleSignature(preferences, snapshot.mode),
    deliveredEventIds: [...new Set(deliveredEventIds)].slice(-64),
    updatedAtMs: snapshot.observedAtMs,
  };
  return transactIdempotent(
    [],
    { id: mutationId, fingerprint: JSON.stringify(value) },
    async (revision) => {
      await timeSliceDb.meta.put({
        id: cursorId(snapshot.timerKey),
        value,
        revision,
        updatedAtMs: snapshot.observedAtMs,
      });
      return value;
    },
  );
}

export async function deleteAlertCursor(
  timerKey: string,
  mutationId: string = crypto.randomUUID(),
) {
  return transactIdempotent(
    [],
    { id: mutationId, fingerprint: JSON.stringify({ timerKey }) },
    async () => {
      await timeSliceDb.meta.delete(cursorId(timerKey));
      return timerKey;
    },
  );
}
