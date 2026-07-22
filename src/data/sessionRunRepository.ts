import {
  normalizePersistedSessionRun,
  type PersistedSessionRun,
} from "../domain/sessionSnapshot";
import { timeSliceDb, transact } from "./timesliceDb";

const CURRENT_SESSION_RUN_ID = "current";

export const getSessionRun = async () => {
  const value = (await timeSliceDb.sessionRuns.get(CURRENT_SESSION_RUN_ID))
    ?.value;
  return normalizePersistedSessionRun(value) || undefined;
};

export const saveSessionRun = async (value: unknown) => {
  const normalized = normalizePersistedSessionRun(value);
  if (!normalized) throw new TypeError("Invalid persisted Session run");
  return transact(["sessionRuns"], async (revision) => {
    await timeSliceDb.sessionRuns.put({
      id: CURRENT_SESSION_RUN_ID,
      value: normalized,
      revision,
      updatedAtMs: Date.now(),
    });
    return normalized satisfies PersistedSessionRun;
  });
};

export const deleteSessionRun = async () =>
  transact(["sessionRuns"], async () => {
    await timeSliceDb.sessionRuns.delete(CURRENT_SESSION_RUN_ID);
  });
