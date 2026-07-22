import type { SessionActivitySlice } from "../domain/sessionRun";
import {
  normalizeActivitySessionContext,
  normalizeActivitySessionRecord,
  type ActivitySessionContext,
  type ActivitySessionEndReason,
  type ActivitySessionRecord,
} from "../domain/activitySession";
import { timeSliceDb, transactIdempotent } from "./timesliceDb";

const LEDGER_EPOCH_ID = "activity-session-ledger-started-at";

export class ActivitySessionRevisionConflictError extends Error {
  constructor() {
    super("This activity record changed in another TimeSlice window.");
    this.name = "ActivitySessionRevisionConflictError";
  }
}

export type ActivitySessionCommand =
  | {
      type: "start";
      sourceTimerId: string;
      atMs: number;
      context: ActivitySessionContext;
    }
  | {
      type: "end";
      sourceTimerId: string;
      atMs: number;
      reason: ActivitySessionEndReason;
    };

const safeTimestamp = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Date.now();

const openSessions = (sourceTimerId: string) =>
  timeSliceDb.activitySessions
    .where("[sourceTimerId+status]")
    .equals([sourceTimerId, "running"])
    .toArray();

const ensureLedgerEpoch = async (atMs: number, revision: number) => {
  const existing = await timeSliceDb.meta.get(LEDGER_EPOCH_ID);
  if (typeof existing?.value === "number" && Number.isFinite(existing.value)) {
    return Math.max(0, Math.floor(existing.value));
  }
  const epoch = safeTimestamp(atMs);
  await timeSliceDb.meta.put({
    id: LEDGER_EPOCH_ID,
    value: epoch,
    revision,
    updatedAtMs: epoch,
  });
  return epoch;
};

const createRunningSession = (
  sourceTimerId: string,
  context: ActivitySessionContext,
  startedAtMs: number,
  revision: number,
  id: string = crypto.randomUUID(),
): ActivitySessionRecord => ({
  id,
  sourceTimerId,
  ...context,
  status: "running",
  startedAtMs,
  endedAtMs: null,
  durationMs: 0,
  corrections: [],
  revision,
  createdAtMs: startedAtMs,
  updatedAtMs: startedAtMs,
});

const finishSession = async (
  session: ActivitySessionRecord,
  endedAtMs: number,
  reason: ActivitySessionEndReason,
  revision: number,
) => {
  const end = Math.max(session.startedAtMs, safeTimestamp(endedAtMs));
  const durationMs = end - session.startedAtMs;
  if (durationMs <= 0) {
    await timeSliceDb.activitySessions.delete(session.id);
    return null;
  }
  const completed: ActivitySessionRecord = {
    ...session,
    status: "completed",
    endedAtMs: end,
    durationMs,
    endReason: reason,
    revision,
    updatedAtMs: end,
  };
  await timeSliceDb.activitySessions.put(completed);
  return completed;
};

/** Applies a recording command inside an existing IndexedDB transaction. */
export async function applyActivitySessionCommand(
  command: ActivitySessionCommand,
  revision: number,
) {
  const atMs = safeTimestamp(command.atMs);
  const epoch = await ensureLedgerEpoch(atMs, revision);
  const atOrAfterEpoch = Math.max(epoch, atMs);
  const active = await openSessions(command.sourceTimerId);

  if (command.type === "end") {
    const completed = await Promise.all(
      active.map((session) =>
        finishSession(session, atOrAfterEpoch, command.reason, revision),
      ),
    );
    return completed.filter(Boolean);
  }

  const context = normalizeActivitySessionContext(command.context);
  if (!context) throw new TypeError("Invalid activity recording context");
  const matching = active.find(
    (session) =>
      session.activityId === context.activityId &&
      session.kind === context.kind &&
      session.source === context.source,
  );
  if (matching && active.length === 1) return matching;

  await Promise.all(
    active.map((session) =>
      finishSession(session, atOrAfterEpoch, "switched", revision),
    ),
  );
  const created = createRunningSession(
    command.sourceTimerId,
    context,
    atOrAfterEpoch,
    revision,
  );
  await timeSliceDb.activitySessions.put(created);
  return created;
}

export async function switchActivitySession(
  sourceTimerId: string,
  context: ActivitySessionContext,
  atMs = Date.now(),
  mutationId: string = crypto.randomUUID(),
) {
  const command: ActivitySessionCommand = {
    type: "start",
    sourceTimerId,
    context,
    atMs: safeTimestamp(atMs),
  };
  return transactIdempotent(
    ["activitySessions"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    (revision) => applyActivitySessionCommand(command, revision),
  );
}

export async function endActivitySession(
  sourceTimerId: string,
  reason: ActivitySessionEndReason,
  atMs = Date.now(),
  mutationId: string = crypto.randomUUID(),
) {
  const command: ActivitySessionCommand = {
    type: "end",
    sourceTimerId,
    reason,
    atMs: safeTimestamp(atMs),
  };
  return transactIdempotent(
    ["activitySessions"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    (revision) => applyActivitySessionCommand(command, revision),
  );
}

export type ActivityTraceContext = {
  sourceTimerId: string;
  observedAtMs: number;
  elapsedSeconds: number;
  slices: SessionActivitySlice[];
  activities: ActivitySessionContext[];
  currentActivity?: ActivitySessionContext | null;
  continues: boolean;
};

/**
 * Materializes only meaningful Session boundaries. A normal one-task tick is
 * left as a running timestamp anchor and therefore causes no database write.
 */
export async function applyActivitySessionTrace(
  input: ActivityTraceContext,
  mutationId = `activity-trace:${input.sourceTimerId}:${safeTimestamp(input.observedAtMs)}:${Math.max(0, Math.floor(input.elapsedSeconds))}`,
) {
  const fingerprint = JSON.stringify(input);
  return transactIdempotent(
    ["activitySessions"],
    { id: mutationId, fingerprint },
    async (revision) => {
      const observedAtMs = safeTimestamp(input.observedAtMs);
      const elapsedSeconds = Math.max(0, Math.floor(input.elapsedSeconds));
      const batchStartMs = Math.max(0, observedAtMs - elapsedSeconds * 1_000);
      const epoch = await ensureLedgerEpoch(observedAtMs, revision);
      const activityById = new Map(
        input.activities.map((activity) => [activity.activityId, activity]),
      );
      const slices = input.slices
        .map((slice) => ({
          ...slice,
          startMs: batchStartMs + Math.max(0, slice.offsetSeconds) * 1_000,
          endMs:
            batchStartMs +
            (Math.max(0, slice.offsetSeconds) +
              Math.max(0, slice.durationSeconds)) *
              1_000,
        }))
        .filter((slice) => slice.endMs > epoch && slice.endMs > slice.startMs);

      let active = (await openSessions(input.sourceTimerId))[0] || null;
      const completed: ActivitySessionRecord[] = [];
      const firstStartMs = slices[0]?.startMs;
      if (active && firstStartMs !== undefined && firstStartMs > batchStartMs) {
        const closed = await finishSession(
          active,
          Math.max(epoch, batchStartMs),
          "flow-break",
          revision,
        );
        if (closed) completed.push(closed);
        active = null;
      }

      for (let index = 0; index < slices.length; index += 1) {
        const slice = slices[index];
        const metadata = activityById.get(slice.activityId);
        if (!metadata) continue;
        const context: ActivitySessionContext = {
          ...metadata,
          kind: slice.kind,
        };
        const startMs = Math.max(epoch, slice.startMs);
        const endMs = Math.max(startMs, slice.endMs);
        const sameActive =
          active?.activityId === context.activityId &&
          active.kind === context.kind &&
          active.source === context.source;
        if (active && !sameActive) {
          const closed = await finishSession(
            active,
            startMs,
            "automatic",
            revision,
          );
          if (closed) completed.push(closed);
          active = null;
        }
        if (!active) {
          active = createRunningSession(
            input.sourceTimerId,
            context,
            startMs,
            revision,
            `trace:${input.sourceTimerId}:${startMs}:${encodeURIComponent(context.activityId)}:${context.kind}`,
          );
          await timeSliceDb.activitySessions.put(active);
        }
        const next = slices[index + 1];
        const shouldClose =
          Boolean(next) ||
          !input.continues ||
          input.currentActivity?.activityId !== context.activityId ||
          input.currentActivity?.kind !== context.kind;
        if (shouldClose) {
          const closed = await finishSession(
            active,
            endMs,
            "automatic",
            revision,
          );
          if (closed) completed.push(closed);
          active = null;
        }
      }

      const current = input.currentActivity
        ? normalizeActivitySessionContext(input.currentActivity)
        : null;
      if (input.continues && current) {
        const matchesCurrent =
          active?.activityId === current.activityId &&
          active.kind === current.kind &&
          active.source === current.source;
        if (active && !matchesCurrent) {
          const closed = await finishSession(
            active,
            observedAtMs,
            "automatic",
            revision,
          );
          if (closed) completed.push(closed);
          active = null;
        }
        if (!active) {
          active = createRunningSession(
            input.sourceTimerId,
            current,
            Math.max(epoch, observedAtMs),
            revision,
          );
          await timeSliceDb.activitySessions.put(active);
        }
      }

      return { completed, active };
    },
  );
}

export async function listActivitySessions(
  options: { includeDeleted?: boolean } = {},
) {
  const records = await timeSliceDb.activitySessions
    .orderBy("startedAtMs")
    .reverse()
    .toArray();
  return records
    .map(normalizeActivitySessionRecord)
    .filter((record): record is ActivitySessionRecord => Boolean(record))
    .filter(
      (record) => options.includeDeleted || record.deletedAtMs === undefined,
    );
}

export async function correctActivitySession(
  id: string,
  patch: { activityName: string; startedAtMs: number; durationMs: number },
  expectedRevision: number,
  mutationId: string = crypto.randomUUID(),
) {
  const requestedStartedAtMs = Number(patch.startedAtMs);
  const requestedDurationMs = Number(patch.durationMs);
  if (
    !Number.isFinite(requestedStartedAtMs) ||
    !Number.isFinite(requestedDurationMs)
  ) {
    throw new TypeError("A valid start time and duration are required.");
  }
  const normalizedPatch = {
    activityName: patch.activityName.trim(),
    startedAtMs: Math.max(0, Math.floor(requestedStartedAtMs)),
    durationMs: Math.max(0, Math.floor(requestedDurationMs)),
  };
  if (!normalizedPatch.activityName || normalizedPatch.durationMs <= 0) {
    throw new TypeError("Activity name and a positive duration are required.");
  }
  const fingerprint = JSON.stringify({ id, normalizedPatch, expectedRevision });
  return transactIdempotent(
    ["activitySessions"],
    { id: mutationId, fingerprint },
    async (revision) => {
      const existing = await timeSliceDb.activitySessions.get(id);
      if (!existing || existing.revision !== expectedRevision) {
        throw new ActivitySessionRevisionConflictError();
      }
      if (existing.status === "running") {
        throw new TypeError("A running activity record cannot be corrected.");
      }
      const correctedAtMs = Date.now();
      const corrected: ActivitySessionRecord = {
        ...existing,
        activityName: normalizedPatch.activityName,
        startedAtMs: normalizedPatch.startedAtMs,
        endedAtMs: normalizedPatch.startedAtMs + normalizedPatch.durationMs,
        durationMs: normalizedPatch.durationMs,
        corrections: [
          ...existing.corrections,
          {
            correctedAtMs,
            previousActivityName: existing.activityName,
            previousStartedAtMs: existing.startedAtMs,
            previousEndedAtMs: existing.endedAtMs || existing.startedAtMs,
            previousDurationMs: existing.durationMs,
          },
        ],
        revision,
        updatedAtMs: correctedAtMs,
      };
      await timeSliceDb.activitySessions.put(corrected);
      return corrected;
    },
  );
}

export async function setActivitySessionDeleted(
  id: string,
  deleted: boolean,
  expectedRevision: number,
  mutationId: string = crypto.randomUUID(),
) {
  const fingerprint = JSON.stringify({ id, deleted, expectedRevision });
  return transactIdempotent(
    ["activitySessions"],
    { id: mutationId, fingerprint },
    async (revision) => {
      const existing = await timeSliceDb.activitySessions.get(id);
      if (!existing || existing.revision !== expectedRevision) {
        throw new ActivitySessionRevisionConflictError();
      }
      if (existing.status === "running") {
        throw new TypeError("A running activity record cannot be deleted.");
      }
      const updatedAtMs = Date.now();
      const updated: ActivitySessionRecord = {
        ...existing,
        deletedAtMs: deleted ? updatedAtMs : undefined,
        revision,
        updatedAtMs,
      };
      await timeSliceDb.activitySessions.put(updated);
      return updated;
    },
  );
}
