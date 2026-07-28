export type DailyTagWheelMetric = "plan" | "actual";
export type DailyTagWheelLayout = "per-tag" | "combined";

export type TagWheelTag = {
  id: string;
  name: string;
  color: string;
};

export type TagWheelActivity = {
  id: string;
  name: string;
  color: string;
  tagIds: string[];
  plannedSeconds: number;
  actualSeconds: number;
};

export type TagWheelSegment = {
  id: string;
  name: string;
  color: string;
  seconds: number;
  share: number;
};

export type DailyTagWheelModel = {
  id: string;
  title: string;
  totalSeconds: number;
  segments: TagWheelSegment[];
};

const safeSeconds = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const normalized = (value: string) => value.trim().toLocaleLowerCase();

export function resolveTagId(
  value: string,
  tags: readonly TagWheelTag[],
): string {
  const token = normalized(value);
  return (
    tags.find(
      (tag) => normalized(tag.id) === token || normalized(tag.name) === token,
    )?.id || value
  );
}

const withShares = (
  segments: Omit<TagWheelSegment, "share">[],
): { totalSeconds: number; segments: TagWheelSegment[] } => {
  const totalSeconds = segments.reduce(
    (sum, segment) => sum + safeSeconds(segment.seconds),
    0,
  );
  return {
    totalSeconds,
    segments: segments.map((segment) => ({
      ...segment,
      seconds: safeSeconds(segment.seconds),
      share: totalSeconds > 0 ? safeSeconds(segment.seconds) / totalSeconds : 0,
    })),
  };
};

export function buildDailyTagWheels({
  activities,
  tags,
  selectedTagIds,
  metric,
  layout,
}: {
  activities: readonly TagWheelActivity[];
  tags: readonly TagWheelTag[];
  selectedTagIds: readonly string[];
  metric: DailyTagWheelMetric;
  layout: DailyTagWheelLayout;
}): DailyTagWheelModel[] {
  const selected = selectedTagIds
    .map((id) => resolveTagId(id, tags))
    .filter((id, index, all) => all.indexOf(id) === index);
  if (selected.length === 0) return [];
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const normalizedActivities = activities.map((activity) => ({
    ...activity,
    tagIds: activity.tagIds.map((id) => resolveTagId(id, tags)),
    value:
      metric === "plan"
        ? safeSeconds(activity.plannedSeconds)
        : safeSeconds(activity.actualSeconds),
  }));

  if (layout === "per-tag") {
    return selected.map((tagId) => {
      const tag = tagById.get(tagId);
      const values = withShares(
        normalizedActivities
          .filter((activity) => activity.tagIds.includes(tagId))
          .map((activity) => ({
            id: activity.id,
            name: activity.name,
            color: activity.color,
            seconds: activity.value,
          })),
      );
      return {
        id: tagId,
        title: tag?.name || tagId,
        ...values,
      };
    });
  }

  const totals = new Map(selected.map((tagId) => [tagId, 0]));
  normalizedActivities.forEach((activity) => {
    const matches = selected.filter((tagId) => activity.tagIds.includes(tagId));
    if (matches.length === 0) return;
    const attributed = activity.value / matches.length;
    matches.forEach((tagId) =>
      totals.set(tagId, (totals.get(tagId) || 0) + attributed),
    );
  });
  const values = withShares(
    selected.map((tagId) => {
      const tag = tagById.get(tagId);
      return {
        id: tagId,
        name: tag?.name || tagId,
        color: tag?.color || "#94a3b8",
        seconds: totals.get(tagId) || 0,
      };
    }),
  );
  return [{ id: "combined", title: "Selected tags", ...values }];
}
