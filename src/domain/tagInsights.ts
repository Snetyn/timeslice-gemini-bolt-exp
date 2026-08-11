import type { ActivityDefinitionRecord } from "./activityCatalog";
import type { ActivitySessionRecord } from "./activitySession";

export type TagRatioMetric = "plan" | "remaining" | "actual";
export type TagMatchMode = "any" | "all";
export type TagChartView = "donut" | "radar" | "rpg";

export type TagInsightTag = {
  id: string;
  name: string;
  color: string;
};

export type TagRatioActivity = {
  id: string;
  tagIds: string[];
  planSeconds: number;
  remainingSeconds: number;
  actualSeconds: number;
  excluded?: boolean;
};

export type TagRatioSegment = TagInsightTag & {
  seconds: number;
  ratio: number;
};

export type TagRatioModel = {
  metric: TagRatioMetric;
  matchMode: TagMatchMode;
  totalSeconds: number;
  matchedActivityCount: number;
  segments: TagRatioSegment[];
};

export type TagRpgLevel = TagInsightTag & {
  attributedSeconds: number;
  level: number;
  progress: number;
  secondsToNextLevel: number;
};

const normalized = (value: unknown) =>
  typeof value === "string" ? value.trim().toLocaleLowerCase() : "";

const safeSeconds = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const safeColor = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "#64748b";

const unique = (values: readonly unknown[]) => [
  ...new Set(values.map(normalized).filter(Boolean)),
];

const normalizedTags = (tags: readonly TagInsightTag[]) => {
  const seen = new Set<string>();
  return tags.flatMap((tag) => {
    const id = normalized(tag?.id);
    const name = typeof tag?.name === "string" ? tag.name.trim() : "";
    if (!id || !name || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name, color: safeColor(tag.color) }];
  });
};

export function buildTagRatioModel({
  activities,
  tags,
  selectedTagIds,
  metric,
  matchMode,
}: {
  activities: readonly TagRatioActivity[];
  tags: readonly TagInsightTag[];
  selectedTagIds: readonly string[];
  metric: TagRatioMetric;
  matchMode: TagMatchMode;
}): TagRatioModel {
  const available = normalizedTags(tags);
  const tagById = new Map(available.map((tag) => [tag.id, tag]));
  const selected = unique(selectedTagIds).filter((id) => tagById.has(id));
  const totals = new Map(selected.map((id) => [id, 0]));
  let matchedActivityCount = 0;

  for (const activity of activities) {
    if (!activity || activity.excluded) continue;
    const activityTags = unique(
      Array.isArray(activity.tagIds) ? activity.tagIds : [],
    );
    const matches = selected.filter((id) => activityTags.includes(id));
    const included =
      selected.length > 0 &&
      (matchMode === "all"
        ? matches.length === selected.length
        : matches.length > 0);
    if (!included || matches.length === 0) continue;
    matchedActivityCount += 1;
    const seconds = safeSeconds(
      metric === "plan"
        ? activity.planSeconds
        : metric === "remaining"
          ? activity.remainingSeconds
          : activity.actualSeconds,
    );
    const attributed = seconds / matches.length;
    for (const id of matches)
      totals.set(id, (totals.get(id) || 0) + attributed);
  }

  const totalSeconds = [...totals.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  return {
    metric,
    matchMode,
    totalSeconds,
    matchedActivityCount,
    segments: selected.map((id) => {
      const tag = tagById.get(id)!;
      const seconds = safeSeconds(totals.get(id));
      return {
        ...tag,
        seconds,
        ratio: totalSeconds > 0 ? seconds / totalSeconds : 0,
      };
    }),
  };
}

const recordDurationMs = (record: ActivitySessionRecord, nowMs: number) => {
  if (record.deletedAtMs !== undefined || record.endReason === "flow-break")
    return 0;
  const sourceKey = normalized(record.sourceKey);
  const activityId = normalized(record.activityId);
  if (
    activityId === "timeslice-banked-rest" ||
    sourceKey.includes("banked-rest") ||
    sourceKey.includes("reward-rest") ||
    sourceKey.includes("flow-reserve")
  ) {
    return 0;
  }
  if (record.status === "running")
    return Math.max(0, nowMs - safeSeconds(record.startedAtMs));
  return safeSeconds(record.durationMs);
};

export function buildTagRpgLevels({
  records,
  definitions,
  tags,
  selectedTagIds,
  minutesPerLevel,
  nowMs = Date.now(),
}: {
  records: readonly ActivitySessionRecord[];
  definitions: readonly ActivityDefinitionRecord[];
  tags: readonly TagInsightTag[];
  selectedTagIds: readonly string[];
  minutesPerLevel: number;
  nowMs?: number;
}): TagRpgLevel[] {
  const available = normalizedTags(tags);
  const tagById = new Map(available.map((tag) => [tag.id, tag]));
  const selected = unique(selectedTagIds).filter((id) => tagById.has(id));
  const definitionById = new Map(definitions.map((item) => [item.id, item]));
  const definitionBySourceKey = new Map<string, ActivityDefinitionRecord>();
  for (const definition of definitions) {
    for (const sourceKey of definition.sourceKeys || []) {
      const key = normalized(sourceKey);
      if (key && !definitionBySourceKey.has(key))
        definitionBySourceKey.set(key, definition);
    }
  }
  const totals = new Map(available.map((tag) => [tag.id, 0]));

  for (const record of records) {
    const durationMs = recordDurationMs(record, nowMs);
    if (durationMs <= 0) continue;
    const definition =
      (record.activityDefinitionId
        ? definitionById.get(record.activityDefinitionId)
        : undefined) ||
      (record.sourceKey
        ? definitionBySourceKey.get(normalized(record.sourceKey))
        : undefined);
    if (!definition) continue;
    const currentTags = unique(definition.tagIds || []).filter((id) =>
      tagById.has(id),
    );
    if (currentTags.length === 0) continue;
    const attributedSeconds = durationMs / 1_000 / currentTags.length;
    for (const id of currentTags)
      totals.set(id, (totals.get(id) || 0) + attributedSeconds);
  }

  const levelSeconds = Math.max(
    60,
    Math.round(safeSeconds(minutesPerLevel) * 60),
  );
  return selected.map((id) => {
    const tag = tagById.get(id)!;
    const attributedSeconds = safeSeconds(totals.get(id));
    const level = Math.floor(attributedSeconds / levelSeconds);
    const remainder = attributedSeconds - level * levelSeconds;
    return {
      ...tag,
      attributedSeconds,
      level,
      progress: remainder / levelSeconds,
      secondsToNextLevel: Math.max(0, levelSeconds - remainder),
    };
  });
}
