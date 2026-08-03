export type TagSource = "rpg" | "custom";

export type CanonicalTag = {
  key: string;
  name: string;
  color: string;
  storageValue: string;
  source: TagSource;
};

type TagContainer = { tags?: unknown };

type RpgTagLike = {
  id?: unknown;
  name?: unknown;
  color?: unknown;
};

const FALLBACK_TAG_COLOR = "#64748b";

export const normalizeTagName = (value: unknown): string =>
  typeof value === "string"
    ? value.trim().toLocaleLowerCase().replace(/\s+/g, " ")
    : "";

export const normalizeAssignedTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const token = item.trim();
    const comparable = normalizeTagName(token);
    if (!token || seen.has(comparable)) continue;
    seen.add(comparable);
    result.push(token);
  }
  return result;
};

export const tagColor = (value: unknown): string => {
  const name = normalizeTagName(value) || "tag";
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 62%, 46%)`;
};

const safeColor = (value: unknown, name: string) =>
  typeof value === "string" && value.trim() ? value.trim() : tagColor(name);

const collectContainerTags = (containers: readonly TagContainer[]) =>
  containers.flatMap((container) => normalizeAssignedTags(container?.tags));

export function buildCanonicalTags({
  rpgTags,
  customTags,
  templates = [],
  activities = [],
}: {
  rpgTags: readonly RpgTagLike[] | unknown;
  customTags: unknown;
  templates?: readonly TagContainer[];
  activities?: readonly TagContainer[];
}): CanonicalTag[] {
  const result: CanonicalTag[] = [];
  const names = new Set<string>();
  const ids = new Set<string>();

  if (Array.isArray(rpgTags)) {
    for (const candidate of rpgTags) {
      if (!candidate || typeof candidate !== "object") continue;
      const tag = candidate as RpgTagLike;
      const id = typeof tag.id === "string" ? tag.id.trim() : "";
      const name = typeof tag.name === "string" ? tag.name.trim() : "";
      const normalizedName = normalizeTagName(name);
      if (!id || !normalizedName || ids.has(id) || names.has(normalizedName))
        continue;
      ids.add(id);
      names.add(normalizedName);
      result.push({
        key: `rpg:${id}`,
        name,
        color: safeColor(tag.color, name) || FALLBACK_TAG_COLOR,
        storageValue: id,
        source: "rpg",
      });
    }
  }

  const textTags = [
    ...normalizeAssignedTags(customTags),
    ...collectContainerTags(templates),
    ...collectContainerTags(activities),
  ];
  for (const value of textTags) {
    const normalizedName = normalizeTagName(value);
    if (!normalizedName || names.has(normalizedName) || ids.has(value))
      continue;
    names.add(normalizedName);
    result.push({
      key: `custom:${normalizedName}`,
      name: value.trim(),
      color: tagColor(normalizedName),
      storageValue: normalizedName,
      source: "custom",
    });
  }

  return result.sort((left, right) => left.name.localeCompare(right.name));
}

export const isTagAssigned = (
  assigned: unknown,
  tag: Pick<CanonicalTag, "name" | "storageValue">,
) => {
  const values = normalizeAssignedTags(assigned);
  const targetName = normalizeTagName(tag.name);
  return values.some(
    (value) =>
      value === tag.storageValue || normalizeTagName(value) === targetName,
  );
};

export const setTagAssignment = (
  assigned: unknown,
  tag: Pick<CanonicalTag, "name" | "storageValue">,
  selected: boolean,
): string[] => {
  const values = normalizeAssignedTags(assigned);
  const targetName = normalizeTagName(tag.name);
  const without = values.filter(
    (value) =>
      value !== tag.storageValue && normalizeTagName(value) !== targetName,
  );
  return selected ? [...without, tag.storageValue] : without;
};

export const applyTagsToLinkedActivities = <
  T extends { id: string; sharedId?: string; tags?: unknown },
>(
  activities: readonly T[],
  sourceId: string,
  sourceSharedId: string | undefined,
  tags: unknown,
): T[] => {
  const normalizedTags = normalizeAssignedTags(tags);
  return activities.map((activity) =>
    activity.id === sourceId ||
    Boolean(sourceSharedId && activity.sharedId === sourceSharedId)
      ? { ...activity, tags: normalizedTags }
      : activity,
  );
};
