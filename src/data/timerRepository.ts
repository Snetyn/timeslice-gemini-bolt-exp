import {
  cancelTimer,
  checkpointTimer,
  completeTimer,
  createTimer,
  pauseTimer,
  reconcileTimer,
  resetTimer,
  startTimer,
  type TimerState,
} from "../domain/timer";
import {
  timeSliceDb,
  transact,
  transactIdempotent,
  MutationIdConflictError,
  type SessionHistoryRecord,
} from "./timesliceDb";
import {
  applyActivitySessionCommand,
  type ActivitySessionCommand,
} from "./activitySessionRepository";
import type {
  ActivitySessionContext,
  ActivitySessionEndReason,
} from "../domain/activitySession";

export { MutationIdConflictError } from "./timesliceDb";

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
  mutationFingerprint = JSON.stringify({
    kind: "timer-save",
    timerId: timer.id,
    expectedRevision,
    timer,
  }),
  activityCommand?: ActivitySessionCommand,
) {
  return transactIdempotent(
    activityCommand
      ? ["timers", "activitySessions", "activityDefinitions", "lifeAreas"]
      : ["timers"],
    { id: mutationId, fingerprint: mutationFingerprint },
    async (workspaceRevision) => {
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
      if (activityCommand) {
        await applyActivitySessionCommand(activityCommand, workspaceRevision);
      }
      return next;
    },
  );
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
  const activityCommand: ActivitySessionCommand | undefined =
    stored.value.status === "running" && next.status === "completed"
      ? {
          type: "end",
          sourceTimerId: id,
          atMs: next.updatedAtMs,
          reason: "automatic",
        }
      : undefined;
  const mutationId = crypto.randomUUID();
  return (
    await saveTimer(
      next,
      stored.value.revision,
      mutationId,
      JSON.stringify({
        kind: "timer-reconcile",
        timerId: id,
        expectedRevision: stored.value.revision,
        timer: next,
        activityCommand,
      }),
      activityCommand,
    )
  ).value;
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
      if (next.revision === value.revision) return value;
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

export type TimerCommand =
  "start" | "pause" | "checkpoint" | "complete" | "cancel" | "reset";

/**
 * Applies one semantic timer command with bounded conflict retries. No timer
 * command is issued by the display scheduler, so IndexedDB is never written
 * merely because another second appeared on screen.
 */
export async function transitionTimer(
  id: string,
  command: TimerCommand,
  options: {
    nowMs?: number;
    targetDurationMs?: number | null;
    mutationId?: string;
    recording?: {
      context?: ActivitySessionContext;
      endReason?: ActivitySessionEndReason;
    };
  } = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const mutationId = options.mutationId ?? crypto.randomUUID();
  const mutationFingerprint = JSON.stringify({
    kind: "timer-command",
    timerId: id,
    command,
    nowMs,
    targetDurationMs: options.targetDurationMs,
    recording: options.recording,
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing =
      (await getTimer(id)) ||
      createTimer(id, nowMs, options.targetDurationMs ?? null);
    const next =
      command === "start"
        ? startTimer(
            options.targetDurationMs === undefined
              ? existing
              : resetTimer(existing, nowMs, options.targetDurationMs),
            nowMs,
          )
        : command === "pause"
          ? pauseTimer(existing, nowMs)
          : command === "checkpoint"
            ? checkpointTimer(existing, nowMs)
            : command === "complete"
              ? completeTimer(existing, nowMs)
              : command === "cancel"
                ? cancelTimer(existing, nowMs)
                : resetTimer(
                    existing,
                    nowMs,
                    options.targetDurationMs ?? existing.targetDurationMs,
                  );
    try {
      const activityCommand: ActivitySessionCommand | undefined =
        command === "start" && options.recording?.context
          ? {
              type: "start",
              sourceTimerId: id,
              atMs: nowMs,
              context: options.recording.context,
            }
          : command !== "checkpoint" && options.recording
            ? {
                type: "end",
                sourceTimerId: id,
                atMs: nowMs,
                reason:
                  options.recording.endReason ||
                  (command === "pause"
                    ? "paused"
                    : command === "complete"
                      ? "completed"
                      : command === "reset"
                        ? "reset"
                        : "cancelled"),
              }
            : undefined;
      return (
        await saveTimer(
          next,
          existing.revision,
          mutationId,
          mutationFingerprint,
          activityCommand,
        )
      ).value;
    } catch (error) {
      if (error instanceof MutationIdConflictError) throw error;
      if (!(error instanceof RevisionConflictError) || attempt === 2)
        throw error;
    }
  }
  throw new RevisionConflictError();
}
