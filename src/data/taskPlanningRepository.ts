import {
  adaptiveEstimateSeconds,
  localDateKey,
  normalizeDailyPlan,
  normalizeRecurrenceRule,
  normalizeTaskOccurrence,
  recurrenceMatchesDate,
  type DailyPlanRecord,
  type TaskOccurrenceRecord,
  type TaskPlannerSettings,
} from "../domain/taskPlanning";
import {
  normalizeActivityDefinition,
  type ActivityDefinitionRecord,
} from "../domain/activityCatalog";
import { createActivityDefinition } from "./activityCatalogRepository";
import { timeSliceDb, transactIdempotent } from "./timesliceDb";

const SETTINGS_ID = "task-planner-v1";
const UPDATE_EVENT = "timeslice-task-planner-update";

const notify = () => {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(UPDATE_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("timeslice-task-planner");
    channel.postMessage({ type: "changed" });
    channel.close();
  }
};

export const subscribeTaskPlanning = (listener: () => void) => {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(UPDATE_EVENT, listener);
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("timeslice-task-planner")
      : null;
  channel?.addEventListener("message", listener);
  return () => {
    window.removeEventListener(UPDATE_EVENT, listener);
    channel?.removeEventListener("message", listener);
    channel?.close();
  };
};

export const defaultTaskPlannerSettings = (): TaskPlannerSettings => ({
  version: 1,
  onboarded: false,
  normalWindowStartMinutes: 480,
  normalWindowEndMinutes: 1320,
  lastRecurrenceCheckDate: null,
});

export async function getTaskPlannerSettings() {
  const stored = await timeSliceDb.settings.get(SETTINGS_ID);
  const value = stored?.value as Partial<TaskPlannerSettings> | undefined;
  const start = Number(value?.normalWindowStartMinutes);
  const end = Number(value?.normalWindowEndMinutes);
  return {
    ...defaultTaskPlannerSettings(),
    onboarded: Boolean(value?.onboarded),
    normalWindowStartMinutes: Number.isFinite(start)
      ? Math.max(0, Math.min(1439, Math.floor(start)))
      : 480,
    normalWindowEndMinutes: Number.isFinite(end)
      ? Math.max(1, Math.min(1440, Math.floor(end)))
      : 1320,
    lastRecurrenceCheckDate:
      typeof value?.lastRecurrenceCheckDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.lastRecurrenceCheckDate)
        ? value.lastRecurrenceCheckDate
        : null,
    version: 1 as const,
  };
}

export async function saveTaskPlannerSettings(
  value: TaskPlannerSettings,
  mutationId = crypto.randomUUID(),
) {
  const command = { type: "save-task-planner-settings", value };
  const result = await transactIdempotent(
    ["settings"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      await timeSliceDb.settings.put({
        id: SETTINGS_ID,
        value: { ...value, version: 1 },
        revision,
        updatedAtMs: Date.now(),
      });
      return { ...value, version: 1 as const };
    },
  );
  notify();
  return result.value;
}

const newOccurrence = (
  input: {
    title: string;
    reusable?: ActivityDefinitionRecord | null;
    folderId?: string | null;
    tagIds?: string[];
    localDate?: string | null;
    baselineDurationSeconds?: number;
    color?: string;
    minimumDurationSeconds?: number;
    durationMode?: TaskOccurrenceRecord["durationMode"];
    schedulingMode?: TaskOccurrenceRecord["schedulingMode"];
    exactStartMinutes?: number | null;
    windowStartMinutes?: number | null;
    windowEndMinutes?: number | null;
  },
  revision: number,
  nowMs: number,
): TaskOccurrenceRecord => {
  const definition = input.reusable || null;
  const baseline = Math.max(
    60,
    definition?.baselineDurationSeconds ||
      input.baselineDurationSeconds ||
      3600,
  );
  return {
    id: crypto.randomUUID(),
    activityDefinitionId: definition?.id || null,
    title: input.title.trim(),
    color: input.color?.trim() || definition?.color || "#6366f1",
    tagIds: [...new Set(input.tagIds || definition?.tagIds || [])],
    folderId: input.folderId ?? definition?.folderId ?? null,
    status: input.localDate ? "planned" : "inbox",
    localDate: input.localDate || null,
    schedulingMode:
      input.schedulingMode || definition?.schedulingMode || "flexible",
    exactStartMinutes:
      input.exactStartMinutes ?? definition?.exactStartMinutes ?? null,
    windowStartMinutes:
      input.windowStartMinutes ?? definition?.windowStartMinutes ?? null,
    windowEndMinutes:
      input.windowEndMinutes ?? definition?.windowEndMinutes ?? null,
    plannedDurationSeconds: baseline,
    minimumDurationSeconds: Math.min(
      baseline,
      input.minimumDurationSeconds ??
        definition?.minimumDurationSeconds ??
        Math.floor(baseline / 2),
    ),
    durationOverrideSeconds: null,
    durationMode: input.durationMode || definition?.durationMode || "fixed",
    placementStartMinutes: null,
    actualFocusedSeconds: 0,
    completedAtMs: null,
    completionSnapshot: null,
    skippedDueDates: [],
    recurrenceKey: null,
    revision,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
};

export async function createInboxTask(input: {
  title: string;
  kind: "one-off" | "reusable";
  folderId?: string | null;
  tagIds?: string[];
  baselineDurationSeconds?: number;
  color?: string;
  minimumDurationSeconds?: number;
  durationMode?: TaskOccurrenceRecord["durationMode"];
  schedulingMode?: TaskOccurrenceRecord["schedulingMode"];
  exactStartMinutes?: number | null;
  windowStartMinutes?: number | null;
  windowEndMinutes?: number | null;
  protected?: boolean;
  recurrenceRule?: ActivityDefinitionRecord["recurrenceRule"];
  rolloverPolicy?: ActivityDefinitionRecord["rolloverPolicy"];
}) {
  const title = input.title.trim();
  if (!title) throw new TypeError("A task name is required.");
  let definition: ActivityDefinitionRecord | null = null;
  if (input.kind === "reusable") {
    definition = (
      await createActivityDefinition({
        name: title,
        color: input.color,
        folderId: input.folderId || null,
        planningEnabled: true,
        tagIds: input.tagIds || [],
        baselineDurationSeconds: input.baselineDurationSeconds || 3600,
        minimumDurationSeconds:
          input.minimumDurationSeconds ??
          Math.floor((input.baselineDurationSeconds || 3600) / 2),
        durationMode: input.durationMode,
        schedulingMode: input.schedulingMode,
        exactStartMinutes: input.exactStartMinutes,
        windowStartMinutes: input.windowStartMinutes,
        windowEndMinutes: input.windowEndMinutes,
        protected: input.protected,
        recurrenceRule: input.recurrenceRule,
        rolloverPolicy: input.rolloverPolicy,
      })
    ).value;
  }
  const nowMs = Date.now();
  const command = {
    type: "create-inbox-task",
    title,
    definitionId: definition?.id || null,
    nowMs,
  };
  const result = await transactIdempotent(
    ["taskOccurrences"],
    { id: crypto.randomUUID(), fingerprint: JSON.stringify(command) },
    async (revision) => {
      const occurrence = newOccurrence(
        {
          title,
          reusable: definition,
          folderId: input.folderId,
          tagIds: input.tagIds,
          baselineDurationSeconds: input.baselineDurationSeconds,
          color: input.color,
          minimumDurationSeconds: input.minimumDurationSeconds,
          durationMode: input.durationMode,
          schedulingMode: input.schedulingMode,
          exactStartMinutes: input.exactStartMinutes,
          windowStartMinutes: input.windowStartMinutes,
          windowEndMinutes: input.windowEndMinutes,
        },
        revision,
        nowMs,
      );
      await timeSliceDb.taskOccurrences.add(occurrence);
      return occurrence;
    },
  );
  notify();
  return result.value;
}

export async function listTaskOccurrences(
  options: {
    status?: TaskOccurrenceRecord["status"];
    localDate?: string | null;
    includeCompleted?: boolean;
  } = {},
) {
  return (
    await timeSliceDb.taskOccurrences.orderBy("updatedAtMs").reverse().toArray()
  )
    .map(normalizeTaskOccurrence)
    .filter((item): item is TaskOccurrenceRecord => Boolean(item))
    .filter((item) => (options.status ? item.status === options.status : true))
    .filter((item) =>
      options.localDate !== undefined
        ? item.localDate === options.localDate
        : true,
    )
    .filter(
      (item) =>
        options.includeCompleted !== false || item.status !== "completed",
    );
}

export async function listPlannerDefinitions() {
  return (await timeSliceDb.activityDefinitions.orderBy("order").toArray())
    .map(normalizeActivityDefinition)
    .filter((item): item is ActivityDefinitionRecord => Boolean(item))
    .filter((item) => item.planningEnabled && item.archivedAtMs === undefined);
}

export async function scheduleTaskOccurrence(
  id: string,
  localDate: string,
  changes: Partial<
    Pick<
      TaskOccurrenceRecord,
      | "folderId"
      | "plannedDurationSeconds"
      | "minimumDurationSeconds"
      | "schedulingMode"
      | "exactStartMinutes"
      | "windowStartMinutes"
      | "windowEndMinutes"
      | "placementStartMinutes"
    >
  > = {},
) {
  const current = await timeSliceDb.taskOccurrences.get(id);
  if (!current) throw new TypeError("Task no longer exists.");
  const command = {
    type: "schedule-task",
    id,
    localDate,
    changes,
    expectedRevision: current.revision,
  };
  const result = await transactIdempotent(
    ["taskOccurrences"],
    { id: crypto.randomUUID(), fingerprint: JSON.stringify(command) },
    async (revision) => {
      const latest = await timeSliceDb.taskOccurrences.get(id);
      if (!latest || latest.revision !== current.revision)
        throw new Error("Task changed in another window.");
      const normalized = normalizeTaskOccurrence({
        ...latest,
        ...changes,
        localDate,
        status: "planned",
        revision,
        updatedAtMs: Date.now(),
      })!;
      await timeSliceDb.taskOccurrences.put(normalized);
      return normalized;
    },
  );
  notify();
  return result.value;
}

export async function organizeTaskOccurrence(
  id: string,
  changes: { folderId?: string | null; localDate?: string | null },
) {
  const organized = Boolean(changes.folderId || changes.localDate);
  return updateTaskOccurrence(id, {
    ...changes,
    status: organized ? "planned" : "inbox",
  });
}

export async function updateTaskOccurrence(
  id: string,
  changes: Partial<
    Omit<TaskOccurrenceRecord, "id" | "revision" | "createdAtMs">
  >,
) {
  const current = await timeSliceDb.taskOccurrences.get(id);
  if (!current) throw new TypeError("Task no longer exists.");
  const command = {
    type: "update-task-occurrence",
    id,
    changes,
    expectedRevision: current.revision,
  };
  const result = await transactIdempotent(
    ["taskOccurrences"],
    { id: crypto.randomUUID(), fingerprint: JSON.stringify(command) },
    async (revision) => {
      const latest = await timeSliceDb.taskOccurrences.get(id);
      if (!latest || latest.revision !== current.revision)
        throw new Error("Task changed in another window.");
      const normalized = normalizeTaskOccurrence({
        ...latest,
        ...changes,
        revision,
        updatedAtMs: Date.now(),
      });
      if (!normalized) throw new TypeError("Invalid task update.");
      await timeSliceDb.taskOccurrences.put(normalized);
      return normalized;
    },
  );
  notify();
  return result.value;
}

export async function refreshOccurrenceActual(id: string) {
  const sessions = await timeSliceDb.activitySessions
    .where("taskOccurrenceId")
    .equals(id)
    .toArray();
  const observedAtMs = Date.now();
  const actualFocusedSeconds = Math.floor(
    sessions
      .filter(
        (session) => !session.deletedAtMs && session.endReason !== "flow-break",
      )
      .reduce(
        (sum, session) =>
          sum +
          Math.max(
            0,
            session.status === "running"
              ? observedAtMs - session.startedAtMs
              : session.durationMs,
          ),
        0,
      ) / 1000,
  );
  const current = normalizeTaskOccurrence(
    await timeSliceDb.taskOccurrences.get(id),
  );
  if (!current) throw new TypeError("Task no longer exists.");
  if (current.actualFocusedSeconds === actualFocusedSeconds) return current;
  return updateTaskOccurrence(id, { actualFocusedSeconds });
}

export async function completeTaskOccurrence(
  id: string,
  completedAtMs = Date.now(),
) {
  const refreshed = await refreshOccurrenceActual(id);
  if (refreshed.status === "completed" && refreshed.completionSnapshot)
    return refreshed;
  return updateTaskOccurrence(id, {
    status: "completed",
    actualFocusedSeconds: refreshed.actualFocusedSeconds,
    completedAtMs,
    completionSnapshot: {
      title: refreshed.title,
      plannedDurationSeconds: refreshed.plannedDurationSeconds,
      actualFocusedSeconds: refreshed.actualFocusedSeconds,
      completedAtMs,
    },
  });
}

export async function promoteOneOffTask(id: string) {
  const occurrence = await timeSliceDb.taskOccurrences.get(id);
  if (!occurrence) throw new TypeError("Task no longer exists.");
  if (occurrence.activityDefinitionId) return occurrence;
  const definition = (
    await createActivityDefinition({
      name: occurrence.title,
      color: occurrence.color,
      folderId: occurrence.folderId,
      planningEnabled: true,
      tagIds: occurrence.tagIds,
      baselineDurationSeconds: occurrence.plannedDurationSeconds,
      minimumDurationSeconds: occurrence.minimumDurationSeconds,
      schedulingMode: occurrence.schedulingMode,
      exactStartMinutes: occurrence.exactStartMinutes,
      windowStartMinutes: occurrence.windowStartMinutes,
      windowEndMinutes: occurrence.windowEndMinutes,
      durationMode: occurrence.durationMode,
    })
  ).value;
  return updateTaskOccurrence(id, { activityDefinitionId: definition.id });
}

export async function getAdaptiveEstimate(definitionId: string) {
  const definition = normalizeActivityDefinition(
    await timeSliceDb.activityDefinitions.get(definitionId),
  );
  if (!definition) throw new TypeError("Activity no longer exists.");
  const completed = (
    await listTaskOccurrences({ includeCompleted: true })
  ).filter(
    (item) =>
      item.activityDefinitionId === definitionId && item.status === "completed",
  );
  return {
    seconds: adaptiveEstimateSeconds(
      completed,
      definition.baselineDurationSeconds || 3600,
      definition.minimumDurationSeconds || 0,
    ),
    sampleCount: completed.filter((item) => item.actualFocusedSeconds > 0)
      .length,
  };
}

const datesAfter = (
  startExclusive: string | null | undefined,
  endInclusive: string,
) => {
  if (!startExclusive || !/^\d{4}-\d{2}-\d{2}$/.test(startExclusive))
    return [endInclusive];
  const result: string[] = [];
  const cursor = new Date(`${startExclusive}T12:00:00`);
  const end = new Date(`${endInclusive}T12:00:00`);
  for (
    cursor.setDate(cursor.getDate() + 1);
    cursor <= end && result.length < 366;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    result.push(localDateKey(cursor));
  }
  return result;
};

export async function ensureRecurringOccurrences(localDate = localDateKey()) {
  const plannerSettings = await getTaskPlannerSettings();
  const definitions = await listPlannerDefinitions();
  const existing = await listTaskOccurrences({ includeCompleted: true });
  const created: TaskOccurrenceRecord[] = [];
  for (const dueDate of datesAfter(
    plannerSettings.lastRecurrenceCheckDate,
    localDate,
  )) {
    for (const definition of definitions) {
      const rule = normalizeRecurrenceRule(definition.recurrenceRule);
      if (!recurrenceMatchesDate(rule, dueDate)) continue;
      const recurrenceKey = `${definition.id}:${dueDate}`;
      if (existing.some((item) => item.recurrenceKey === recurrenceKey))
        continue;
      const open = existing.find(
        (item) =>
          item.activityDefinitionId === definition.id &&
          !["completed", "missed"].includes(item.status),
      );
      if (open && definition.rolloverPolicy !== "skip") {
        if (
          open.localDate !== dueDate &&
          !open.skippedDueDates.includes(dueDate)
        ) {
          const updated = await updateTaskOccurrence(open.id, {
            skippedDueDates: [...open.skippedDueDates, dueDate],
          });
          const index = existing.findIndex((item) => item.id === open.id);
          if (index >= 0) existing[index] = updated;
        }
        continue;
      }
      if (
        open &&
        definition.rolloverPolicy === "skip" &&
        open.localDate &&
        open.localDate < dueDate
      ) {
        const missed = await updateTaskOccurrence(open.id, {
          status: "missed",
        });
        const index = existing.findIndex((item) => item.id === open.id);
        if (index >= 0) existing[index] = missed;
      }
      const estimate =
        definition.durationMode === "adaptive"
          ? await getAdaptiveEstimate(definition.id)
          : { seconds: definition.baselineDurationSeconds || 3600 };
      const nowMs = Date.now();
      const result = await transactIdempotent(
        ["taskOccurrences"],
        {
          id: `recurrence:${recurrenceKey}`,
          fingerprint: JSON.stringify({ type: "recurrence", recurrenceKey }),
        },
        async (revision) => {
          const occurrence = {
            ...newOccurrence(
              {
                title: definition.name,
                reusable: definition,
                localDate: dueDate,
              },
              revision,
              nowMs,
            ),
            id: `occurrence:${recurrenceKey}`,
            recurrenceKey,
            plannedDurationSeconds: estimate.seconds,
            minimumDurationSeconds: Math.min(
              estimate.seconds,
              definition.minimumDurationSeconds || 0,
            ),
          };
          await timeSliceDb.taskOccurrences.put(occurrence);
          return occurrence;
        },
      );
      created.push(result.value);
      existing.push(result.value);
    }
  }
  if (plannerSettings.lastRecurrenceCheckDate !== localDate) {
    await saveTaskPlannerSettings({
      ...plannerSettings,
      lastRecurrenceCheckDate: localDate,
    });
  }
  if (created.length) notify();
  return created;
}

export async function getOrCreateDailyPlan(localDate = localDateKey()) {
  const existing = normalizeDailyPlan(
    await timeSliceDb.dailyPlans.get(`day:${localDate}`),
  );
  if (existing) return existing;
  const settings = await getTaskPlannerSettings();
  const nowMs = Date.now();
  const result = await transactIdempotent(
    ["dailyPlans"],
    {
      id: `create-daily-plan:${localDate}`,
      fingerprint: JSON.stringify({ type: "create-daily-plan", localDate }),
    },
    async (revision) => {
      const concurrent = normalizeDailyPlan(
        await timeSliceDb.dailyPlans.get(`day:${localDate}`),
      );
      if (concurrent) return concurrent;
      const plan: DailyPlanRecord = {
        id: `day:${localDate}`,
        localDate,
        windowStartMinutes: settings.normalWindowStartMinutes,
        windowEndMinutes: settings.normalWindowEndMinutes,
        capacityOverrideSeconds: null,
        confirmedAtMs: null,
        revision,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      await timeSliceDb.dailyPlans.put(plan);
      return plan;
    },
  );
  return result.value;
}

export async function saveDailyPlan(value: DailyPlanRecord, confirm = false) {
  const command = {
    type: "save-daily-plan",
    value,
    confirm,
    expectedRevision: value.revision,
  };
  const result = await transactIdempotent(
    ["dailyPlans"],
    { id: crypto.randomUUID(), fingerprint: JSON.stringify(command) },
    async (revision) => {
      const current = await timeSliceDb.dailyPlans.get(value.id);
      if (current && current.revision !== value.revision)
        throw new Error("Daily plan changed in another window.");
      const normalized = normalizeDailyPlan({
        ...value,
        confirmedAtMs: confirm ? Date.now() : value.confirmedAtMs,
        revision,
        updatedAtMs: Date.now(),
      });
      if (!normalized) throw new TypeError("Invalid daily plan.");
      await timeSliceDb.dailyPlans.put(normalized);
      return normalized;
    },
  );
  notify();
  return result.value;
}
