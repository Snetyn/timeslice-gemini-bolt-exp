import type {
  ActivityDefinitionRecord,
  ActivityFolderRecord,
} from "./activityCatalog";
import { normalizeSearchName } from "./activityCatalog";
import type { TaskOccurrenceRecord } from "./taskPlanning";
import { normalizeAssignedTags, normalizeTagName, tagColor } from "./tags";

export type OrganizerCollectionKind = "folder" | "list";
export type OrganizerSmartView =
  "all" | "inbox" | "today" | "upcoming" | "completed";
export type OrganizerTagMatch = "any" | "all";

export type OrganizerTagRecord = {
  id: string;
  name: string;
  normalizedName: string;
  color: string;
  aliases: string[];
  source: "rpg" | "custom" | "discovered";
  order: number;
  revision: number;
  createdAtMs: number;
  updatedAtMs: number;
  archivedAtMs?: number;
};

type TagCandidate = {
  id?: unknown;
  name?: unknown;
  color?: unknown;
  aliases?: unknown;
  source: OrganizerTagRecord["source"];
};

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const normalizeOrganizerTag = (
  value: unknown,
): OrganizerTagRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!id || !name) return null;
  const createdAtMs = Number.isFinite(Number(record.createdAtMs))
    ? Math.max(0, Math.floor(Number(record.createdAtMs)))
    : Date.now();
  return {
    id,
    name,
    normalizedName: normalizeTagName(name),
    color:
      typeof record.color === "string" && record.color.trim()
        ? record.color.trim()
        : tagColor(name),
    aliases: normalizeAssignedTags(record.aliases).map(normalizeTagName),
    source:
      record.source === "rpg" || record.source === "custom"
        ? record.source
        : "discovered",
    order: Math.max(0, Math.floor(Number(record.order) || 0)),
    revision: Math.max(0, Math.floor(Number(record.revision) || 0)),
    createdAtMs,
    updatedAtMs: Number.isFinite(Number(record.updatedAtMs))
      ? Math.max(0, Math.floor(Number(record.updatedAtMs)))
      : createdAtMs,
    ...(record.archivedAtMs === undefined
      ? {}
      : { archivedAtMs: Math.max(0, Math.floor(Number(record.archivedAtMs))) }),
  };
};

export function buildOrganizerTagRegistry(
  candidates: TagCandidate[],
  revision: number,
  nowMs: number,
) {
  const result: OrganizerTagRecord[] = [];
  const byName = new Map<string, OrganizerTagRecord>();
  const rank = { rpg: 0, custom: 1, discovered: 2 } as const;
  const ordered = [...candidates].sort(
    (left, right) => rank[left.source] - rank[right.source],
  );
  for (const candidate of ordered) {
    const name =
      typeof candidate.name === "string" ? candidate.name.trim() : "";
    const normalizedName = normalizeTagName(name);
    if (!normalizedName) continue;
    const existing =
      byName.get(normalizedName) ||
      result.find(
        (tag) =>
          tag.id === name ||
          tag.aliases.some(
            (alias) => normalizeTagName(alias) === normalizedName,
          ),
      );
    const rawId = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const legacyAliases = normalizeAssignedTags(candidate.aliases).map(
      normalizeTagName,
    );
    if (existing) {
      existing.aliases = [
        ...new Set([
          ...existing.aliases,
          ...legacyAliases,
          ...(rawId && rawId !== existing.id ? [rawId] : []),
        ]),
      ];
      continue;
    }
    const id =
      candidate.source === "rpg" && rawId
        ? rawId
        : `tag:${stableHash(normalizedName)}`;
    const tag: OrganizerTagRecord = {
      id,
      name,
      normalizedName,
      color:
        typeof candidate.color === "string" && candidate.color.trim()
          ? candidate.color.trim()
          : tagColor(name),
      aliases: [
        ...new Set([
          normalizedName,
          ...legacyAliases,
          ...(rawId && rawId !== id ? [rawId] : []),
        ]),
      ],
      source: candidate.source,
      order: result.length,
      revision,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    result.push(tag);
    byName.set(normalizedName, tag);
  }
  return result;
}

export const resolveOrganizerTagId = (
  value: string,
  tags: OrganizerTagRecord[],
) => {
  const normalized = normalizeTagName(value);
  return (
    tags.find(
      (tag) =>
        tag.id === value ||
        tag.normalizedName === normalized ||
        tag.aliases.some((alias) => normalizeTagName(alias) === normalized),
    )?.id || value
  );
};

export const canonicalizeOrganizerTagIds = (
  values: unknown,
  tags: OrganizerTagRecord[],
) => [
  ...new Set(
    normalizeAssignedTags(values).map((value) =>
      resolveOrganizerTagId(value, tags),
    ),
  ),
];

export function matchesOrganizerTags(
  assigned: unknown,
  selected: string[],
  mode: OrganizerTagMatch,
  tags: OrganizerTagRecord[],
) {
  if (selected.length === 0) return true;
  const assignedIds = new Set(canonicalizeOrganizerTagIds(assigned, tags));
  return mode === "all"
    ? selected.every((id) => assignedIds.has(id))
    : selected.some((id) => assignedIds.has(id));
}

export function matchesOrganizerView(
  occurrence: TaskOccurrenceRecord,
  view: OrganizerSmartView,
  today: string,
) {
  if (view === "all") return occurrence.status !== "missed";
  if (view === "inbox") return occurrence.status === "inbox";
  if (view === "today")
    return occurrence.localDate === today && occurrence.status !== "missed";
  if (view === "upcoming")
    return Boolean(
      occurrence.localDate &&
      occurrence.localDate > today &&
      occurrence.status !== "completed",
    );
  return occurrence.status === "completed" || occurrence.status === "missed";
}

export type OrganizerConversion = {
  collections: ActivityFolderRecord[];
  definitions: ActivityDefinitionRecord[];
  occurrences: TaskOccurrenceRecord[];
  generatedListIds: string[];
};

export function convertOrganizerCollections(input: {
  collections: ActivityFolderRecord[];
  definitions: ActivityDefinitionRecord[];
  occurrences: TaskOccurrenceRecord[];
  revision: number;
  nowMs: number;
}): OrganizerConversion {
  const ids = new Set(input.collections.map((item) => item.id));
  const rawParentById = new Map(
    input.collections.map((item) => [
      item.id,
      item.parentId && ids.has(item.parentId) ? item.parentId : null,
    ]),
  );
  const parentById = new Map<string, string | null>();
  for (const item of input.collections) {
    const path = new Set([item.id]);
    let parentId = rawParentById.get(item.id) || null;
    let invalid = false;
    while (parentId) {
      if (path.has(parentId)) {
        invalid = true;
        break;
      }
      path.add(parentId);
      parentId = rawParentById.get(parentId) || null;
    }
    parentById.set(
      item.id,
      invalid ? null : rawParentById.get(item.id) || null,
    );
  }
  const parentIds = new Set(
    [...parentById.values()].filter((id): id is string => Boolean(id)),
  );
  const collections = input.collections.map((item) => ({
    ...item,
    kind: parentIds.has(item.id) ? ("folder" as const) : ("list" as const),
    color: item.color || (parentIds.has(item.id) ? "#64748b" : "#3b82f6"),
    parentId: parentById.get(item.id) || null,
    revision: input.revision,
    updatedAtMs: input.nowMs,
  }));
  const directFolderIds = new Set(
    [
      ...input.definitions.map((item) => item.folderId),
      ...input.occurrences.map((item) => item.folderId),
    ].filter((id): id is string => Boolean(id && parentIds.has(id))),
  );
  const generalByFolder = new Map<string, string>();
  for (const folderId of directFolderIds) {
    const generalId = `organizer-general:${encodeURIComponent(folderId)}`;
    generalByFolder.set(folderId, generalId);
    if (collections.some((item) => item.id === generalId)) continue;
    const parent = collections.find((item) => item.id === folderId)!;
    collections.push({
      id: generalId,
      name: "General",
      normalizedName: normalizeSearchName("General"),
      kind: "list",
      color: parent.color || "#3b82f6",
      parentId: folderId,
      order: collections.filter((item) => item.parentId === folderId).length,
      revision: input.revision,
      createdAtMs: input.nowMs,
      updatedAtMs: input.nowMs,
    });
  }
  const move = (folderId: string | null) =>
    folderId ? generalByFolder.get(folderId) || folderId : null;
  return {
    collections,
    definitions: input.definitions.map((item) => ({
      ...item,
      folderId: move(item.folderId),
      revision: input.revision,
      updatedAtMs: input.nowMs,
    })),
    occurrences: input.occurrences.map((item) => ({
      ...item,
      folderId: move(item.folderId),
      revision: input.revision,
      updatedAtMs: input.nowMs,
    })),
    generatedListIds: [...generalByFolder.values()],
  };
}
