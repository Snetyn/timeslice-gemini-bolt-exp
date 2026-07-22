import {
  canMoveFolder,
  normalizeActivityDefinition,
  normalizeActivityFolder,
  normalizeLifeArea,
  normalizeSearchName,
  type ActivityDefinitionRecord,
  type ActivityFolderRecord,
  type DecisionType,
  type LifeAreaRecord,
} from "../domain/activityCatalog";
import type { ActivitySessionRecord } from "../domain/activitySession";
import { timeSliceDb, transactIdempotent } from "./timesliceDb";

export class CatalogRevisionConflictError extends Error {
  constructor() {
    super("This item changed in another TimeSlice window.");
    this.name = "CatalogRevisionConflictError";
  }
}

type EditableLifeArea = Pick<LifeAreaRecord, "name" | "color" | "order">;
type EditableFolder = Pick<ActivityFolderRecord, "name" | "parentId" | "order">;
type EditableDefinition = Pick<
  ActivityDefinitionRecord,
  | "name"
  | "aliases"
  | "color"
  | "lifeAreaId"
  | "folderId"
  | "order"
  | "protected"
  | "decisionType"
>;

const cleanName = (value: string) => {
  const name = value.trim();
  if (!name) throw new TypeError("A name is required.");
  return name;
};

const nowRecord = (id: string, name: string, revision: number, nowMs: number) => ({
  id,
  name,
  normalizedName: normalizeSearchName(name),
  revision,
  createdAtMs: nowMs,
  updatedAtMs: nowMs,
});

export const listLifeAreas = async (includeArchived = false) =>
  (await timeSliceDb.lifeAreas.orderBy("order").toArray())
    .map(normalizeLifeArea)
    .filter((item): item is LifeAreaRecord => Boolean(item))
    .filter((item) => includeArchived || item.archivedAtMs === undefined);

export const listFolders = async (includeArchived = true) =>
  (await timeSliceDb.activityFolders.orderBy("order").toArray())
    .map(normalizeActivityFolder)
    .filter((item): item is ActivityFolderRecord => Boolean(item))
    .filter((item) => includeArchived || item.archivedAtMs === undefined);

export const listActivityDefinitions = async (includeArchived = false) =>
  (await timeSliceDb.activityDefinitions.orderBy("order").toArray())
    .map(normalizeActivityDefinition)
    .filter((item): item is ActivityDefinitionRecord => Boolean(item))
    .filter((item) => includeArchived || item.archivedAtMs === undefined);

export async function createLifeArea(
  input: { name: string; color: string },
  mutationId: string = crypto.randomUUID(),
) {
  const nowMs = Date.now();
  const id = crypto.randomUUID();
  const command = { type: "create-life-area", id, input, nowMs };
  return transactIdempotent(
    ["lifeAreas"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const area: LifeAreaRecord = {
        ...nowRecord(id, cleanName(input.name), revision, nowMs),
        color: input.color || "#64748b",
        order: await timeSliceDb.lifeAreas.count(),
      };
      await timeSliceDb.lifeAreas.add(area);
      return area;
    },
  );
}

export async function createFolder(
  input: { name: string; parentId?: string | null },
  mutationId: string = crypto.randomUUID(),
) {
  const nowMs = Date.now();
  const id = crypto.randomUUID();
  const command = { type: "create-folder", id, input, nowMs };
  return transactIdempotent(
    ["activityFolders"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      if (input.parentId && !(await timeSliceDb.activityFolders.get(input.parentId))) {
        throw new TypeError("The parent folder no longer exists.");
      }
      const siblings = (await timeSliceDb.activityFolders.toArray()).filter(
        (folder) => folder.parentId === (input.parentId || null),
      ).length;
      const folder: ActivityFolderRecord = {
        ...nowRecord(id, cleanName(input.name), revision, nowMs),
        parentId: input.parentId || null,
        order: siblings,
      };
      await timeSliceDb.activityFolders.add(folder);
      return folder;
    },
  );
}

export async function moveFolder(
  id: string,
  parentId: string | null,
  expectedRevision: number,
  mutationId: string = crypto.randomUUID(),
) {
  const command = { type: "move-folder", id, parentId, expectedRevision };
  return transactIdempotent(
    ["activityFolders"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const folders = await timeSliceDb.activityFolders.toArray();
      const folder = folders.find((item) => item.id === id);
      if (!folder || folder.revision !== expectedRevision) throw new CatalogRevisionConflictError();
      if (!canMoveFolder(folders, id, parentId)) throw new TypeError("That folder move would create an invalid tree.");
      const updated = { ...folder, parentId, revision, updatedAtMs: Date.now() };
      await timeSliceDb.activityFolders.put(updated);
      return updated;
    },
  );
}

export async function updateLifeArea(
  id: string,
  changes: Partial<EditableLifeArea>,
  expectedRevision: number,
  mutationId: string = crypto.randomUUID(),
) {
  const command = { type: "update-life-area", id, changes, expectedRevision };
  return transactIdempotent(
    ["lifeAreas"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const current = await timeSliceDb.lifeAreas.get(id);
      if (!current || current.revision !== expectedRevision)
        throw new CatalogRevisionConflictError();
      const name = changes.name === undefined ? current.name : cleanName(changes.name);
      const updated: LifeAreaRecord = {
        ...current,
        ...changes,
        name,
        normalizedName: normalizeSearchName(name),
        color: changes.color?.trim() || current.color,
        order: changes.order === undefined ? current.order : Math.max(0, Math.floor(changes.order)),
        revision,
        updatedAtMs: Date.now(),
      };
      await timeSliceDb.lifeAreas.put(updated);
      return updated;
    },
  );
}

export async function setLifeAreaArchived(
  id: string,
  archived: boolean,
  expectedRevision: number,
  mutationId: string = crypto.randomUUID(),
) {
  const command = { type: "set-life-area-archived", id, archived, expectedRevision };
  return transactIdempotent(
    ["lifeAreas"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const current = await timeSliceDb.lifeAreas.get(id);
      if (!current || current.revision !== expectedRevision)
        throw new CatalogRevisionConflictError();
      const updated: LifeAreaRecord = {
        ...current,
        archivedAtMs: archived ? Date.now() : undefined,
        revision,
        updatedAtMs: Date.now(),
      };
      await timeSliceDb.lifeAreas.put(updated);
      return updated;
    },
  );
}

export async function updateFolder(
  id: string,
  changes: Partial<EditableFolder>,
  expectedRevision: number,
  mutationId: string = crypto.randomUUID(),
) {
  const command = { type: "update-folder", id, changes, expectedRevision };
  return transactIdempotent(
    ["activityFolders"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const folders = await timeSliceDb.activityFolders.toArray();
      const current = folders.find((folder) => folder.id === id);
      if (!current || current.revision !== expectedRevision)
        throw new CatalogRevisionConflictError();
      const parentId = changes.parentId === undefined ? current.parentId : changes.parentId;
      if (!canMoveFolder(folders, id, parentId))
        throw new TypeError("That folder move would create an invalid tree.");
      const name = changes.name === undefined ? current.name : cleanName(changes.name);
      const updated: ActivityFolderRecord = {
        ...current,
        ...changes,
        name,
        normalizedName: normalizeSearchName(name),
        parentId,
        order: changes.order === undefined ? current.order : Math.max(0, Math.floor(changes.order)),
        revision,
        updatedAtMs: Date.now(),
      };
      await timeSliceDb.activityFolders.put(updated);
      return updated;
    },
  );
}

export async function setFolderArchived(
  id: string,
  archived: boolean,
  expectedRevision: number,
  mutationId: string = crypto.randomUUID(),
) {
  const command = { type: "set-folder-archived", id, archived, expectedRevision };
  return transactIdempotent(
    ["activityFolders"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const current = await timeSliceDb.activityFolders.get(id);
      if (!current || current.revision !== expectedRevision)
        throw new CatalogRevisionConflictError();
      const nowMs = Date.now();
      const updated = {
        ...current,
        archivedAtMs: archived ? nowMs : undefined,
        revision,
        updatedAtMs: nowMs,
      };
      await timeSliceDb.activityFolders.put(updated);
      return updated;
    },
  );
}

export async function createActivityDefinition(
  input: {
    name: string;
    color?: string;
    sourceKeys?: string[];
    lifeAreaId?: string | null;
    folderId?: string | null;
    protected?: boolean;
    decisionType?: DecisionType;
  },
  mutationId: string = crypto.randomUUID(),
) {
  const nowMs = Date.now();
  const id = crypto.randomUUID();
  const command = { type: "create-activity-definition", id, input, nowMs };
  return transactIdempotent(
    ["activityDefinitions", "lifeAreas", "activityFolders"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      if (input.lifeAreaId) {
        const area = await timeSliceDb.lifeAreas.get(input.lifeAreaId);
        if (!area || area.archivedAtMs !== undefined) throw new TypeError("Choose an active life area.");
      }
      if (input.folderId && !(await timeSliceDb.activityFolders.get(input.folderId))) {
        throw new TypeError("Choose an existing folder.");
      }
      const definition: ActivityDefinitionRecord = {
        ...nowRecord(id, cleanName(input.name), revision, nowMs),
        aliases: [],
        sourceKeys: [...new Set(input.sourceKeys || [])],
        color: input.color || "#3b82f6",
        lifeAreaId: input.lifeAreaId || null,
        folderId: input.folderId || null,
        order: await timeSliceDb.activityDefinitions.count(),
        protected: Boolean(input.protected),
        decisionType: input.decisionType || "normal",
      };
      await timeSliceDb.activityDefinitions.add(definition);
      return definition;
    },
  );
}

export async function updateActivityDefinition(
  id: string,
  changes: Partial<EditableDefinition>,
  expectedRevision: number,
  mutationId: string = crypto.randomUUID(),
) {
  const command = { type: "update-activity-definition", id, changes, expectedRevision };
  return transactIdempotent(
    ["activityDefinitions", "lifeAreas", "activityFolders"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const current = await timeSliceDb.activityDefinitions.get(id);
      if (!current || current.revision !== expectedRevision)
        throw new CatalogRevisionConflictError();
      const lifeAreaId = changes.lifeAreaId === undefined ? current.lifeAreaId : changes.lifeAreaId;
      const folderId = changes.folderId === undefined ? current.folderId : changes.folderId;
      if (lifeAreaId) {
        const area = await timeSliceDb.lifeAreas.get(lifeAreaId);
        if (!area || area.archivedAtMs !== undefined)
          throw new TypeError("Choose an active life area.");
      }
      if (folderId && !(await timeSliceDb.activityFolders.get(folderId)))
        throw new TypeError("Choose an existing folder.");
      const name = changes.name === undefined ? current.name : cleanName(changes.name);
      const previousNormalized = normalizeSearchName(current.name);
      const aliases = [...new Set([
        ...(changes.aliases || current.aliases).map(normalizeSearchName),
        ...(name !== current.name ? [previousNormalized] : []),
      ])].filter((alias) => alias && alias !== normalizeSearchName(name));
      const updated: ActivityDefinitionRecord = {
        ...current,
        ...changes,
        name,
        normalizedName: normalizeSearchName(name),
        aliases,
        color: changes.color?.trim() || current.color,
        lifeAreaId,
        folderId,
        order: changes.order === undefined ? current.order : Math.max(0, Math.floor(changes.order)),
        revision,
        updatedAtMs: Date.now(),
      };
      await timeSliceDb.activityDefinitions.put(updated);
      return updated;
    },
  );
}

export async function setActivityDefinitionArchived(
  id: string,
  archived: boolean,
  expectedRevision: number,
  mutationId: string = crypto.randomUUID(),
) {
  const command = { type: "set-activity-definition-archived", id, archived, expectedRevision };
  return transactIdempotent(
    ["activityDefinitions"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const current = await timeSliceDb.activityDefinitions.get(id);
      if (!current || current.revision !== expectedRevision)
        throw new CatalogRevisionConflictError();
      const nowMs = Date.now();
      const updated = {
        ...current,
        archivedAtMs: archived ? nowMs : undefined,
        revision,
        updatedAtMs: nowMs,
      };
      await timeSliceDb.activityDefinitions.put(updated);
      return updated;
    },
  );
}

export async function findDefinitionsByName(name: string) {
  const normalized = normalizeSearchName(name);
  return (await listActivityDefinitions(true)).filter(
    (item) => item.normalizedName === normalized || item.aliases.includes(normalized),
  );
}

export async function findDefinitionBySourceKey(sourceKey: string) {
  const candidates = await timeSliceDb.activityDefinitions.where("sourceKeys").equals(sourceKey).toArray();
  return candidates.map(normalizeActivityDefinition).find(Boolean) || null;
}

export async function listRecentActivityDefinitions(limit = 6) {
  const sessions = await timeSliceDb.activitySessions
    .orderBy("startedAtMs")
    .reverse()
    .toArray();
  const folders = await timeSliceDb.activityFolders.toArray();
  const archivedFolderIds = new Set(
    folders
      .filter((folder) => {
        let cursor: ActivityFolderRecord | undefined = folder;
        const visited = new Set<string>();
        while (cursor) {
          if (visited.has(cursor.id) || cursor.archivedAtMs !== undefined) return true;
          visited.add(cursor.id);
          cursor = cursor.parentId
            ? folders.find((candidate) => candidate.id === cursor?.parentId)
            : undefined;
        }
        return false;
      })
      .map((folder) => folder.id),
  );
  const result: ActivityDefinitionRecord[] = [];
  const seen = new Set<string>();
  for (const session of sessions) {
    if (!session.activityDefinitionId || seen.has(session.activityDefinitionId)) continue;
    const definition = await timeSliceDb.activityDefinitions.get(session.activityDefinitionId);
    if (
      !definition ||
      definition.archivedAtMs !== undefined ||
      (definition.folderId && archivedFolderIds.has(definition.folderId))
    ) continue;
    seen.add(definition.id);
    result.push(definition);
    if (result.length >= Math.max(0, Math.floor(limit))) break;
  }
  return result;
}

export type LegacyHistoryCandidate = {
  key: string;
  activityId: string;
  activityName: string;
  source: ActivitySessionRecord["source"];
  count: number;
  durationMs: number;
  firstAtMs: number;
  lastAtMs: number;
};

export async function previewLegacyHistoryCandidates(definitionId: string) {
  const definition = await timeSliceDb.activityDefinitions.get(definitionId);
  if (!definition) throw new TypeError("Activity not found.");
  const searchNames = new Set([definition.normalizedName, ...definition.aliases]);
  const records = await timeSliceDb.activitySessions.toArray();
  const groups = new Map<string, LegacyHistoryCandidate>();
  for (const record of records) {
    if (record.activityDefinitionId || record.deletedAtMs !== undefined) continue;
    if (!searchNames.has(normalizeSearchName(record.activityName))) continue;
    const key = `${record.source}:${record.activityId}`;
    const current = groups.get(key);
    groups.set(key, {
      key,
      activityId: record.activityId,
      activityName: record.activityName,
      source: record.source,
      count: (current?.count || 0) + 1,
      durationMs: (current?.durationMs || 0) + record.durationMs,
      firstAtMs: Math.min(current?.firstAtMs ?? record.startedAtMs, record.startedAtMs),
      lastAtMs: Math.max(current?.lastAtMs ?? record.startedAtMs, record.endedAtMs || record.startedAtMs),
    });
  }
  return [...groups.values()].sort((left, right) => right.lastAtMs - left.lastAtMs);
}

export async function adoptLegacyHistory(
  definitionId: string,
  candidateKeys: string[],
  mutationId: string = crypto.randomUUID(),
) {
  const keys = [...new Set(candidateKeys)].sort();
  const command = { type: "adopt-legacy-history", definitionId, keys };
  return transactIdempotent(
    ["activityDefinitions", "lifeAreas", "activitySessions"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const definition = await timeSliceDb.activityDefinitions.get(definitionId);
      if (!definition) throw new TypeError("Activity not found.");
      const area = definition.lifeAreaId ? await timeSliceDb.lifeAreas.get(definition.lifeAreaId) : undefined;
      const records = await timeSliceDb.activitySessions.toArray();
      const changed: ActivitySessionRecord[] = [];
      const correctedAtMs = Date.now();
      for (const record of records) {
        const key = `${record.source}:${record.activityId}`;
        if (!keys.includes(key) || record.activityDefinitionId) continue;
        const updated: ActivitySessionRecord = {
          ...record,
          activityDefinitionId: definition.id,
          lifeAreaId: area?.id,
          lifeAreaName: area?.name,
          lifeAreaColor: area?.color,
          classificationSource: "legacy-adoption",
          classifiedAtMs: correctedAtMs,
          classificationCorrections: [
            ...(record.classificationCorrections || []),
            {
              correctedAtMs,
              nextActivityDefinitionId: definition.id,
              nextLifeAreaId: area?.id,
              nextLifeAreaName: area?.name,
              reason: "legacy-adoption",
            },
          ],
          revision,
          updatedAtMs: correctedAtMs,
        };
        changed.push(updated);
      }
      if (changed.length) await timeSliceDb.activitySessions.bulkPut(changed);
      return changed;
    },
  );
}
