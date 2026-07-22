import type { PersistedSessionRun } from "../domain/sessionSnapshot";
import { timeSliceDb, transact } from "./timesliceDb";

const CURRENT_SESSION_RUN_ID = "current";

export const getSessionRun = async () =>
  (await timeSliceDb.sessionRuns.get(CURRENT_SESSION_RUN_ID))?.value;

export const saveSessionRun = async (value: PersistedSessionRun) =>
  transact(["sessionRuns"], async (revision) => {
    await timeSliceDb.sessionRuns.put({
      id: CURRENT_SESSION_RUN_ID,
      value,
      revision,
      updatedAtMs: Date.now(),
    });
    return value;
  });

export const deleteSessionRun = async () =>
  transact(["sessionRuns"], async () => {
    await timeSliceDb.sessionRuns.delete(CURRENT_SESSION_RUN_ID);
  });
