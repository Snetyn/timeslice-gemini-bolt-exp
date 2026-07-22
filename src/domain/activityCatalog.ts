export type DecisionType = "normal" | "leisure" | "distraction";

type DurableRecord = {
  id: string;
  revision: number;
  createdAtMs: number;
  updatedAtMs: number;
  archivedAtMs?: number;
};

export type LifeAreaRecord = DurableRecord & {
  name: string;
  normalizedName: string;
  color: string;
  order: number;
};

export type ActivityFolderRecord = DurableRecord & {
  name: string;
  normalizedName: string;
  parentId: string | null;
  order: number;
};

export type ActivityDefinitionRecord = DurableRecord & {
  name: string;
  normalizedName: string;
  aliases: string[];
  sourceKeys: string[];
  color: string;
  lifeAreaId: string | null;
  folderId: string | null;
  order: number;
  protected: boolean;
  decisionType: DecisionType;
};

export type FlatFolder = ActivityFolderRecord & {
  depth: number;
  effectivelyArchived: boolean;
  invalidParent: boolean;
};

export const normalizeSearchName = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

const finiteInteger = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
};

const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
    : [];

const baseRecord = (value: Record<string, unknown>) => {
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!id || !name) return null;
  const createdAtMs = finiteInteger(value.createdAtMs, Date.now());
  return {
    id,
    name,
    normalizedName: normalizeSearchName(name),
    revision: finiteInteger(value.revision),
    createdAtMs,
    updatedAtMs: finiteInteger(value.updatedAtMs, createdAtMs),
    archivedAtMs:
      value.archivedAtMs === undefined
        ? undefined
        : finiteInteger(value.archivedAtMs),
  };
};

export const normalizeLifeArea = (value: unknown): LifeAreaRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const base = baseRecord(record);
  if (!base) return null;
  return {
    ...base,
    color:
      typeof record.color === "string" && record.color.trim()
        ? record.color
        : "#64748b",
    order: finiteInteger(record.order),
  };
};

export const normalizeActivityFolder = (
  value: unknown,
): ActivityFolderRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const base = baseRecord(record);
  if (!base) return null;
  return {
    ...base,
    parentId:
      typeof record.parentId === "string" && record.parentId.trim()
        ? record.parentId
        : null,
    order: finiteInteger(record.order),
  };
};

export const normalizeActivityDefinition = (
  value: unknown,
): ActivityDefinitionRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const base = baseRecord(record);
  if (!base) return null;
  const decisionType: DecisionType =
    record.decisionType === "leisure" || record.decisionType === "distraction"
      ? record.decisionType
      : "normal";
  return {
    ...base,
    aliases: stringArray(record.aliases).map(normalizeSearchName),
    sourceKeys: stringArray(record.sourceKeys),
    color:
      typeof record.color === "string" && record.color.trim()
        ? record.color
        : "#64748b",
    lifeAreaId:
      typeof record.lifeAreaId === "string" && record.lifeAreaId.trim()
        ? record.lifeAreaId
        : null,
    folderId:
      typeof record.folderId === "string" && record.folderId.trim()
        ? record.folderId
        : null,
    order: finiteInteger(record.order),
    protected: Boolean(record.protected),
    decisionType,
  };
};

export const flattenFolderTree = (
  folders: ActivityFolderRecord[],
  includeArchived = false,
): FlatFolder[] => {
  const byParent = new Map<string | null, ActivityFolderRecord[]>();
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  for (const folder of folders) {
    const parent = folder.parentId && byId.has(folder.parentId) ? folder.parentId : null;
    const siblings = byParent.get(parent) || [];
    siblings.push(folder);
    byParent.set(parent, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  }

  const result: FlatFolder[] = [];
  const visited = new Set<string>();
  const stack = (byParent.get(null) || []).slice().reverse().map((folder) => ({
    folder,
    depth: 0,
    ancestorArchived: false,
    invalidParent: Boolean(folder.parentId && !byId.has(folder.parentId)),
  }));
  while (stack.length) {
    const item = stack.pop()!;
    if (visited.has(item.folder.id)) continue;
    visited.add(item.folder.id);
    const effectivelyArchived = item.ancestorArchived || item.folder.archivedAtMs !== undefined;
    if (includeArchived || !effectivelyArchived) {
      result.push({ ...item.folder, depth: item.depth, effectivelyArchived, invalidParent: item.invalidParent });
    }
    const children = byParent.get(item.folder.id) || [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({
        folder: children[index],
        depth: item.depth + 1,
        ancestorArchived: effectivelyArchived,
        invalidParent: false,
      });
    }
  }
  for (const folder of folders) {
    if (!visited.has(folder.id) && includeArchived) {
      result.push({ ...folder, depth: 0, effectivelyArchived: true, invalidParent: true });
    }
  }
  return result;
};

export const canMoveFolder = (
  folders: ActivityFolderRecord[],
  folderId: string,
  parentId: string | null,
) => {
  if (folderId === parentId) return false;
  if (parentId === null) return folders.some((folder) => folder.id === folderId);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  if (!byId.has(folderId) || !byId.has(parentId)) return false;
  const visited = new Set<string>();
  let cursor: string | null = parentId;
  while (cursor) {
    if (cursor === folderId || visited.has(cursor)) return false;
    visited.add(cursor);
    cursor = byId.get(cursor)?.parentId || null;
  }
  return true;
};

export const isEffectivelyArchived = (
  folderId: string | null,
  folders: ActivityFolderRecord[],
) => {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const visited = new Set<string>();
  let cursor = folderId;
  while (cursor) {
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    const folder = byId.get(cursor);
    if (!folder) return true;
    if (folder.archivedAtMs !== undefined) return true;
    cursor = folder.parentId;
  }
  return false;
};
