export type TaskSchedulingMode = "flexible" | "exact" | "window";
export type TaskDurationMode = "fixed" | "adaptive";
export type TaskRolloverPolicy = "carry" | "skip";
export type TaskOccurrenceStatus =
  "inbox" | "planned" | "active" | "completed" | "missed" | "deferred";

export type TaskRecurrenceRule =
  | { type: "none" }
  | { type: "daily" }
  | { type: "weekdays"; days: number[] }
  | { type: "monthly"; days: number[] }
  | { type: "yearly"; dates: string[] }
  | { type: "interval"; everyDays: number; anchorDate: string };

export type TaskOccurrenceRecord = {
  id: string;
  activityDefinitionId: string | null;
  title: string;
  color: string;
  tagIds: string[];
  folderId: string | null;
  status: TaskOccurrenceStatus;
  localDate: string | null;
  schedulingMode: TaskSchedulingMode;
  exactStartMinutes: number | null;
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  plannedDurationSeconds: number;
  minimumDurationSeconds: number;
  durationOverrideSeconds: number | null;
  durationMode: TaskDurationMode;
  placementStartMinutes: number | null;
  actualFocusedSeconds: number;
  completedAtMs: number | null;
  completionSnapshot: {
    title: string;
    plannedDurationSeconds: number;
    actualFocusedSeconds: number;
    completedAtMs: number;
  } | null;
  skippedDueDates: string[];
  recurrenceKey: string | null;
  revision: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type DailyPlanRecord = {
  id: string;
  localDate: string;
  windowStartMinutes: number;
  windowEndMinutes: number;
  capacityOverrideSeconds: number | null;
  confirmedAtMs: number | null;
  revision: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type TaskPlannerSettings = {
  version: 1;
  onboarded: boolean;
  normalWindowStartMinutes: number;
  normalWindowEndMinutes: number;
  lastRecurrenceCheckDate?: string | null;
};

export type TaskPlacementConflict = {
  occurrenceId: string;
  kind: "outside-window" | "overlap" | "no-window-gap";
  message: string;
};

const integer = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
};

const minuteOfDay = (value: unknown, fallback: number | null = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  return Math.min(1439, integer(value));
};

const uniqueStrings = (value: unknown) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];

export const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseClockMinutes = (value: string, fallback = 0) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  return Math.min(1439, Number(match[1]) * 60 + Number(match[2]));
};

export const formatClockMinutes = (value: number) =>
  `${String(Math.floor(Math.max(0, value) / 60) % 24).padStart(2, "0")}:${String(Math.max(0, value) % 60).padStart(2, "0")}`;

export const normalizeRecurrenceRule = (value: unknown): TaskRecurrenceRule => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { type: "none" };
  const record = value as Record<string, unknown>;
  if (record.type === "daily") return { type: "daily" };
  if (record.type === "weekdays") {
    return {
      type: "weekdays",
      days: [
        ...new Set(
          (Array.isArray(record.days) ? record.days : [])
            .map(integer)
            .filter((day) => day <= 6),
        ),
      ],
    };
  }
  if (record.type === "monthly") {
    return {
      type: "monthly",
      days: [
        ...new Set(
          (Array.isArray(record.days) ? record.days : [])
            .map(integer)
            .filter((day) => day >= 1 && day <= 31),
        ),
      ],
    };
  }
  if (record.type === "yearly") {
    return {
      type: "yearly",
      dates: uniqueStrings(record.dates).filter((date) =>
        /^\d{2}-\d{2}$/.test(date),
      ),
    };
  }
  if (record.type === "interval") {
    return {
      type: "interval",
      everyDays: Math.max(1, integer(record.everyDays, 1)),
      anchorDate:
        typeof record.anchorDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(record.anchorDate)
          ? record.anchorDate
          : localDateKey(),
    };
  }
  return { type: "none" };
};

export const normalizeTaskOccurrence = (
  value: unknown,
): TaskOccurrenceRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!id || !title) return null;
  const status: TaskOccurrenceStatus = [
    "inbox",
    "planned",
    "active",
    "completed",
    "missed",
    "deferred",
  ].includes(String(record.status))
    ? (record.status as TaskOccurrenceStatus)
    : "inbox";
  const schedulingMode: TaskSchedulingMode =
    record.schedulingMode === "exact" || record.schedulingMode === "window"
      ? record.schedulingMode
      : "flexible";
  const durationMode: TaskDurationMode =
    record.durationMode === "adaptive" ? "adaptive" : "fixed";
  const planned = integer(record.plannedDurationSeconds, 3600);
  return {
    ...record,
    id,
    activityDefinitionId:
      typeof record.activityDefinitionId === "string" &&
      record.activityDefinitionId
        ? record.activityDefinitionId
        : null,
    title,
    color:
      typeof record.color === "string" && record.color
        ? record.color
        : "#6366f1",
    tagIds: uniqueStrings(record.tagIds),
    folderId:
      typeof record.folderId === "string" && record.folderId
        ? record.folderId
        : null,
    status,
    localDate:
      typeof record.localDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(record.localDate)
        ? record.localDate
        : null,
    schedulingMode,
    exactStartMinutes: minuteOfDay(record.exactStartMinutes),
    windowStartMinutes: minuteOfDay(record.windowStartMinutes),
    windowEndMinutes: minuteOfDay(record.windowEndMinutes),
    plannedDurationSeconds: planned,
    minimumDurationSeconds: Math.min(
      planned,
      integer(record.minimumDurationSeconds, Math.floor(planned / 2)),
    ),
    durationOverrideSeconds:
      record.durationOverrideSeconds === null ||
      record.durationOverrideSeconds === undefined
        ? null
        : integer(record.durationOverrideSeconds),
    durationMode,
    placementStartMinutes: minuteOfDay(record.placementStartMinutes),
    actualFocusedSeconds: integer(record.actualFocusedSeconds),
    completedAtMs:
      record.completedAtMs === null
        ? null
        : integer(record.completedAtMs) || null,
    completionSnapshot:
      record.completionSnapshot &&
      typeof record.completionSnapshot === "object" &&
      !Array.isArray(record.completionSnapshot)
        ? {
            title:
              typeof (record.completionSnapshot as Record<string, unknown>)
                .title === "string"
                ? String(
                    (record.completionSnapshot as Record<string, unknown>)
                      .title,
                  )
                : title,
            plannedDurationSeconds: integer(
              (record.completionSnapshot as Record<string, unknown>)
                .plannedDurationSeconds,
              planned,
            ),
            actualFocusedSeconds: integer(
              (record.completionSnapshot as Record<string, unknown>)
                .actualFocusedSeconds,
            ),
            completedAtMs: integer(
              (record.completionSnapshot as Record<string, unknown>)
                .completedAtMs,
            ),
          }
        : null,
    skippedDueDates: uniqueStrings(record.skippedDueDates),
    recurrenceKey:
      typeof record.recurrenceKey === "string" && record.recurrenceKey
        ? record.recurrenceKey
        : null,
    revision: integer(record.revision),
    createdAtMs: integer(record.createdAtMs, Date.now()),
    updatedAtMs: integer(record.updatedAtMs, Date.now()),
  } as TaskOccurrenceRecord;
};

export const normalizeDailyPlan = (value: unknown): DailyPlanRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const localDate =
    typeof record.localDate === "string" ? record.localDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  const start = minuteOfDay(record.windowStartMinutes, 480) || 0;
  const end = Math.max(
    start + 1,
    minuteOfDay(record.windowEndMinutes, 1320) || 1320,
  );
  return {
    id:
      typeof record.id === "string" && record.id
        ? record.id
        : `day:${localDate}`,
    localDate,
    windowStartMinutes: start,
    windowEndMinutes: Math.min(1440, end),
    capacityOverrideSeconds:
      record.capacityOverrideSeconds === null ||
      record.capacityOverrideSeconds === undefined
        ? null
        : integer(record.capacityOverrideSeconds),
    confirmedAtMs:
      record.confirmedAtMs === null || record.confirmedAtMs === undefined
        ? null
        : integer(record.confirmedAtMs),
    revision: integer(record.revision),
    createdAtMs: integer(record.createdAtMs, Date.now()),
    updatedAtMs: integer(record.updatedAtMs, Date.now()),
  };
};

export function recurrenceMatchesDate(
  rule: TaskRecurrenceRule,
  localDate: string,
) {
  if (rule.type === "none") return false;
  const date = new Date(`${localDate}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return false;
  if (rule.type === "daily") return true;
  if (rule.type === "weekdays") return rule.days.includes(date.getDay());
  if (rule.type === "monthly") return rule.days.includes(date.getDate());
  if (rule.type === "yearly") return rule.dates.includes(localDate.slice(5));
  const anchor = new Date(`${rule.anchorDate}T12:00:00`);
  const difference = Math.floor(
    (date.getTime() - anchor.getTime()) / 86_400_000,
  );
  return difference >= 0 && difference % rule.everyDays === 0;
}

export function adaptiveEstimateSeconds(
  completed: Array<
    Pick<TaskOccurrenceRecord, "actualFocusedSeconds" | "status">
  >,
  baselineSeconds: number,
  minimumSeconds: number,
) {
  const samples = completed
    .filter(
      (item) => item.status === "completed" && item.actualFocusedSeconds > 0,
    )
    .map((item) => item.actualFocusedSeconds);
  if (!samples.length)
    return Math.max(integer(minimumSeconds), integer(baselineSeconds));
  const mean =
    samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  return Math.max(integer(minimumSeconds), Math.round(mean / 60) * 60);
}

export function planCapacity(
  plan: DailyPlanRecord,
  occurrences: TaskOccurrenceRecord[],
) {
  const windowSeconds =
    Math.max(0, plan.windowEndMinutes - plan.windowStartMinutes) * 60;
  const availableSeconds = Math.min(
    windowSeconds,
    plan.capacityOverrideSeconds ?? windowSeconds,
  );
  const plannedSeconds = occurrences
    .filter((item) => item.status !== "completed" && item.status !== "missed")
    .reduce((sum, item) => sum + item.plannedDurationSeconds, 0);
  const reducibleSeconds = occurrences
    .filter(
      (item) => item.durationMode === "adaptive" && item.status !== "completed",
    )
    .reduce(
      (sum, item) =>
        sum +
        Math.max(0, item.plannedDurationSeconds - item.minimumDurationSeconds),
      0,
    );
  return {
    windowSeconds,
    availableSeconds,
    plannedSeconds,
    freeSeconds: Math.max(0, availableSeconds - plannedSeconds),
    shortfallSeconds: Math.max(0, plannedSeconds - availableSeconds),
    reducibleSeconds,
    unresolvedShortfallSeconds: Math.max(
      0,
      plannedSeconds - availableSeconds - reducibleSeconds,
    ),
  };
}

export function suggestTaskPlacements(
  plan: DailyPlanRecord,
  source: TaskOccurrenceRecord[],
) {
  const occurrences = source.map((item) => ({ ...item }));
  const conflicts: TaskPlacementConflict[] = [];
  const occupied: Array<{ start: number; end: number; id: string }> = [];
  const durationMinutes = (item: TaskOccurrenceRecord) =>
    Math.max(1, Math.ceil(item.plannedDurationSeconds / 60));
  const exact = occurrences
    .filter((item) => item.schedulingMode === "exact")
    .sort(
      (a, b) => (a.exactStartMinutes ?? 1440) - (b.exactStartMinutes ?? 1440),
    );
  exact.forEach((item) => {
    const start = item.exactStartMinutes ?? plan.windowStartMinutes;
    const end = start + durationMinutes(item);
    if (start < plan.windowStartMinutes || end > plan.windowEndMinutes)
      conflicts.push({
        occurrenceId: item.id,
        kind: "outside-window",
        message: `${item.title} is outside the usable day.`,
      });
    if (occupied.some((block) => start < block.end && end > block.start))
      conflicts.push({
        occurrenceId: item.id,
        kind: "overlap",
        message: `${item.title} overlaps another fixed task.`,
      });
    item.placementStartMinutes = start;
    occupied.push({ start, end, id: item.id });
  });
  const windowed = occurrences
    .filter((item) => item.schedulingMode === "window")
    .sort(
      (a, b) => (a.windowEndMinutes ?? 1440) - (b.windowEndMinutes ?? 1440),
    );
  windowed.forEach((item) => {
    const earliest = Math.max(
      plan.windowStartMinutes,
      item.windowStartMinutes ?? plan.windowStartMinutes,
    );
    const latest = Math.min(
      plan.windowEndMinutes,
      item.windowEndMinutes ?? plan.windowEndMinutes,
    );
    const duration = durationMinutes(item);
    let placement: number | null = null;
    const preferred = item.placementStartMinutes;
    if (
      preferred !== null &&
      preferred >= earliest &&
      preferred + duration <= latest &&
      !occupied.some(
        (block) => preferred < block.end && preferred + duration > block.start,
      )
    ) {
      placement = preferred;
    }
    for (
      let minute = earliest;
      placement === null && minute + duration <= latest;
      minute += 1
    ) {
      if (
        !occupied.some(
          (block) => minute < block.end && minute + duration > block.start,
        )
      ) {
        placement = minute;
        break;
      }
    }
    item.placementStartMinutes = placement;
    if (placement === null)
      conflicts.push({
        occurrenceId: item.id,
        kind: "no-window-gap",
        message: `${item.title} has no available gap in its allowed window.`,
      });
    else
      occupied.push({
        start: placement,
        end: placement + duration,
        id: item.id,
      });
  });
  return { occurrences, conflicts };
}
