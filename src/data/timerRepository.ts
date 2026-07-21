import {
  checkpointTimer,
  reconcileTimer,
  type TimerState,
} from "../domain/timer";
import {
  timeSliceDb,
  transact,
  type SessionHistoryRecord,
} from "./timesliceDb";

export class RevisionConflictError extends Error {
  constructor() {
    super(
      "This timer changed in another TimeSlice window. Refresh and try again.",
    );
    this.name = "RevisionConflictError";
  }
}

export async function getTimer(id: string) {
  return (await timeSliceDb.timers.get(id))?.value;
}

export async function saveTimer(
  timer: TimerState,
  expectedRevision = timer.revision - 1,
  mutationId: string = crypto.randomUUID(),
) {
  return transact(["timers"], async (workspaceRevision) => {
    const existing = await timeSliceDb.timers.get(timer.id);
    if (existing && existing.value.revision !== expectedRevision) {
      throw new RevisionConflictError();
    }
    const next = {
      ...timer,
      revision: Math.max(timer.revision, expectedRevision + 1),
    };
    await timeSliceDb.timers.put({
      id: timer.id,
      value: next,
      revision: workspaceRevision,
      updatedAtMs: Date.now(),
    });
    await timeSliceDb.meta.put({
      id: `mutation:${mutationId}`,
      value: { timerId: timer.id, revision: next.revision },
      revision: workspaceRevision,
      updatedAtMs: Date.now(),
    });
    return next;
  });
}

/** Reconciliation only writes when a real state transition occurred. */
export async function reconcilePersistedTimer(id: string, nowMs = Date.now()) {
  const stored = await timeSliceDb.timers.get(id);
  if (!stored) return undefined;
  const next = reconcileTimer(stored.value, nowMs);
  if (
    next.status === stored.value.status &&
    next.accumulatedMs === stored.value.accumulatedMs
  ) {
    return stored.value;
  }
  return (await saveTimer(next, stored.value.revision)).value;
}

export async function reconcileAllTimers(nowMs = Date.now()) {
  const timers = await timeSliceDb.timers.toArray();
  return Promise.all(
    timers.map((record) => reconcilePersistedTimer(record.id, nowMs)),
  );
}

export async function checkpointPersistedTimers(nowMs = Date.now()) {
  const timers = await timeSliceDb.timers.toArray();
  return Promise.all(
    timers.map(async ({ value }) => {
      if (value.status !== "running") return value;
      const next = checkpointTimer(value, nowMs);
      return (await saveTimer(next, value.revision)).value;
    }),
  );
}

export async function saveSessionReport(
  report: unknown,
  completedAtMs = Date.now(),
) {
  const id = crypto.randomUUID();
  return transact(["sessionReports"], async (revision) => {
    const record: SessionHistoryRecord = {
      id,
      value: { completedAtMs, report },
      revision,
      updatedAtMs: completedAtMs,
    };
    await timeSliceDb.sessionReports.put(record);
    return record;
  });
}

export const listSessionReports = () =>
  timeSliceDb.sessionReports.orderBy("updatedAtMs").reverse().toArray();
