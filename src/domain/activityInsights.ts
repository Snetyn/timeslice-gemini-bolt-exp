import type { ActivitySessionRecord } from "./activitySession";

export type InsightsPeriod = "today" | "week" | "month";
export type PeriodBounds = { startMs: number; endMs: number };

export type AreaInsight = {
  id: string | null;
  name: string;
  color: string;
  durationMs: number;
  intervalCount: number;
  archived: boolean;
};

export type ActivityInsights = {
  period: InsightsPeriod;
  bounds: PeriodBounds;
  totalDurationMs: number;
  intervalCount: number;
  areas: AreaInsight[];
  classifiedAreas: AreaInsight[];
  unassignedDurationMs: number;
  scaleMaxMs: number;
  recent: ActivitySessionRecord[];
  running: ActivitySessionRecord | null;
};

export function periodBounds(period: InsightsPeriod, nowMs = Date.now()): PeriodBounds {
  const now = new Date(nowMs);
  let start: Date;
  let end: Date;
  if (period === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (period === "week") {
    const mondayOffset = (now.getDay() + 6) % 7;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function overlapDurationMs(
  record: ActivitySessionRecord,
  bounds: PeriodBounds,
  nowMs = Date.now(),
) {
  if (record.deletedAtMs !== undefined) return 0;
  const recordEnd =
    record.status === "running"
      ? Math.min(nowMs, bounds.endMs)
      : Math.min(record.endedAtMs || record.startedAtMs, bounds.endMs);
  return Math.max(0, recordEnd - Math.max(record.startedAtMs, bounds.startMs));
}

export function roundedScaleMaximum(maximumMs: number) {
  if (!Number.isFinite(maximumMs) || maximumMs <= 0) return 60_000;
  const magnitude = 10 ** Math.floor(Math.log10(maximumMs));
  const normalized = maximumMs / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

export function buildActivityInsights(
  records: ActivitySessionRecord[],
  period: InsightsPeriod,
  nowMs = Date.now(),
  archivedAreaIds: ReadonlySet<string> = new Set(),
): ActivityInsights {
  const bounds = periodBounds(period, nowMs);
  const areas = new Map<string, AreaInsight>();
  let intervalCount = 0;
  let totalDurationMs = 0;
  let running: ActivitySessionRecord | null = null;
  const included: ActivitySessionRecord[] = [];
  for (const record of records) {
    const durationMs = overlapDurationMs(record, bounds, nowMs);
    if (durationMs <= 0) continue;
    intervalCount += 1;
    totalDurationMs += durationMs;
    included.push(record);
    if (record.status === "running") running = record;
    const key = record.lifeAreaId || "__unassigned__";
    const current = areas.get(key);
    areas.set(key, {
      id: record.lifeAreaId || null,
      name: record.lifeAreaName || "Unassigned",
      color: record.lifeAreaColor || "#94a3b8",
      durationMs: (current?.durationMs || 0) + durationMs,
      intervalCount: (current?.intervalCount || 0) + 1,
      archived: record.lifeAreaId ? archivedAreaIds.has(record.lifeAreaId) : false,
    });
  }
  const sortedAreas = [...areas.values()].sort(
    (left, right) => right.durationMs - left.durationMs || left.name.localeCompare(right.name),
  );
  const classifiedAreas = sortedAreas.filter((area) => area.id !== null);
  return {
    period,
    bounds,
    totalDurationMs,
    intervalCount,
    areas: sortedAreas,
    classifiedAreas,
    unassignedDurationMs: areas.get("__unassigned__")?.durationMs || 0,
    scaleMaxMs: roundedScaleMaximum(
      Math.max(0, ...classifiedAreas.map((area) => area.durationMs)),
    ),
    recent: included.sort((left, right) => right.startedAtMs - left.startedAtMs).slice(0, 8),
    running,
  };
}

export const readableDuration = (durationMs: number) => {
  const seconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${hours}h ${minutes.toString().padStart(2, "0")}m`
    : `${minutes}m ${rest.toString().padStart(2, "0")}s`;
};
