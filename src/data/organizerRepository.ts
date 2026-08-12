import { liveQuery } from "dexie";
import {
  normalizeActivityDefinition,
  normalizeActivityFolder,
  normalizeLifeArea,
  normalizeSearchName,
  type ActivityDefinitionRecord,
  type ActivityFolderRecord,
  type LifeAreaRecord,
} from "../domain/activityCatalog";
import {
  buildOrganizerTagRegistry,
  convertOrganizerCollections,
  normalizeOrganizerTag,
  type OrganizerTagRecord,
} from "../domain/organizer";
import {
  normalizeTaskOccurrence,
  type TaskOccurrenceRecord,
} from "../domain/taskPlanning";
import {
  normalizeAssignedTags,
  normalizeTagName,
  tagColor,
} from "../domain/tags";
import { appStorage, flushAppStorage } from "../lib/storage";
import { timeSliceDb, transact, transactIdempotent } from "./timesliceDb";

const MIGRATION_ID = "organizer-v1";
const TAG_PREFIX = "organizer-tag:";

const parseArray = (key: string): unknown[] => {
  try {
    const value = JSON.parse(appStorage.getItem(key) || "[]") as unknown;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const legacyTagCandidates = () => {
  const rpg: Array<Record<string, unknown> & { source: "rpg" }> = parseArray(
    "timeSliceRPGTags",
  )
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({ ...item, source: "rpg" as const }));
  const custom = normalizeAssignedTags(parseArray("timeSliceCustomTags")).map(
    (name) => ({ name, source: "custom" as const }),
  );
  const knownRpgIds = new Set(
    rpg
      .map((item) => (typeof item.id === "string" ? item.id : ""))
      .filter(Boolean),
  );
  const containers = [
    ...parseArray("timeSliceActivityTemplates"),
    ...parseArray("timeSliceActivities"),
    ...parseArray("timeSliceDailyActivities"),
  ];
  const discovered = containers
    .flatMap((container) =>
      container && typeof container === "object"
        ? normalizeAssignedTags((container as { tags?: unknown }).tags)
        : [],
    )
    .filter((name) => !knownRpgIds.has(name))
    .map((name) => ({
      name,
      source: "discovered" as const,
    }));
  return [...rpg, ...custom, ...discovered];
};

export async function listOrganizerTags(includeArchived = false) {
  const records = await timeSliceDb.tags.toArray();
  return records
    .filter((record) => record.id.startsWith(TAG_PREFIX))
    .map((record) => normalizeOrganizerTag(record.value))
    .filter((tag): tag is OrganizerTagRecord => Boolean(tag))
    .filter((tag) => includeArchived || tag.archivedAtMs === undefined)
    .sort(
      (left, right) =>
        left.order - right.order || left.name.localeCompare(right.name),
    );
}

async function mirrorOrganizerTags(tags: OrganizerTagRecord[]) {
  let oldRpg: Array<Record<string, unknown>> = [];
  try {
    oldRpg = parseArray("timeSliceRPGTags").filter(
      (item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object"),
    );
  } catch {
    oldRpg = [];
  }
  const oldById = new Map(oldRpg.map((item) => [String(item.id || ""), item]));
  appStorage.setItem(
    "timeSliceRPGTags",
    JSON.stringify(
      tags.map((tag) => ({
        ...(oldById.get(tag.id) || {}),
        id: tag.id,
        name: tag.name,
        color: tag.color,
        aliases: tag.aliases,
        archivedAtMs: tag.archivedAtMs,
      })),
    ),
  );
  appStorage.setItem(
    "timeSliceCustomTags",
    JSON.stringify(
      tags
        .filter((tag) => tag.source !== "rpg" && tag.archivedAtMs === undefined)
        .map((tag) => tag.name),
    ),
  );
  await flushAppStorage();
}

const repairOrganizerMirrors = async () => {
  try {
    await mirrorOrganizerTags(await listOrganizerTags(true));
  } catch {
    // IndexedDB is canonical. A blocked compatibility write is retried on load.
  }
};

export const repairOrganizerCompatibility = repairOrganizerMirrors;

export async function adoptLegacyOrganizerTags(
  mutationId = crypto.randomUUID(),
) {
  const current = await listOrganizerTags(true);
  const candidates = legacyTagCandidates();
  const nowMs = Date.now();
  const result = await transactIdempotent(
    ["tags"],
    {
      id: mutationId,
      fingerprint: JSON.stringify({
        type: "adopt-legacy-organizer-tags",
        candidates,
      }),
    },
    async (revision) => {
      const working = current.map((tag) => ({
        ...tag,
        aliases: [...tag.aliases],
      }));
      let adopted = 0;
      for (const candidate of candidates) {
        const rawCandidate = candidate as Record<string, unknown> & {
          source: OrganizerTagRecord["source"];
        };
        const name =
          typeof candidate.name === "string" ? candidate.name.trim() : "";
        const normalizedName = normalizeTagName(name);
        const legacyId =
          typeof rawCandidate.id === "string" ? rawCandidate.id.trim() : "";
        if (!normalizedName) continue;
        const existing = working.find(
          (tag) =>
            tag.id === legacyId ||
            tag.normalizedName === normalizedName ||
            tag.aliases.some(
              (alias) =>
                normalizeTagName(alias) === normalizedName ||
                alias === legacyId,
            ),
        );
        if (existing) {
          const aliases = [
            ...new Set([
              ...existing.aliases,
              normalizedName,
              ...(legacyId && legacyId !== existing.id ? [legacyId] : []),
            ]),
          ];
          const source = candidate.source === "rpg" ? "rpg" : existing.source;
          const color =
            candidate.source === "rpg" &&
            typeof rawCandidate.color === "string" &&
            rawCandidate.color.trim()
              ? rawCandidate.color.trim()
              : existing.color;
          if (
            JSON.stringify(aliases) !== JSON.stringify(existing.aliases) ||
            source !== existing.source ||
            color !== existing.color
          ) {
            Object.assign(existing, {
              aliases,
              source,
              color,
              revision,
              updatedAtMs: nowMs,
            });
            adopted += 1;
          }
          continue;
        }
        const id =
          candidate.source === "rpg" && legacyId
            ? legacyId
            : `tag:${crypto.randomUUID()}`;
        working.push({
          id,
          name,
          normalizedName,
          color:
            typeof rawCandidate.color === "string" && rawCandidate.color.trim()
              ? rawCandidate.color.trim()
              : tagColor(name),
          aliases: [
            normalizedName,
            ...(legacyId && legacyId !== id ? [legacyId] : []),
          ],
          source: candidate.source,
          order: working.length,
          revision,
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        });
        adopted += 1;
      }
      if (adopted > 0)
        await timeSliceDb.tags.bulkPut(
          working.map((tag) => ({
            id: `${TAG_PREFIX}${tag.id}`,
            value: tag,
            revision: tag.revision,
            updatedAtMs: tag.updatedAtMs,
          })),
        );
      return { adopted, total: working.length };
    },
  );
  await repairOrganizerMirrors();
  return result.value;
}

export async function migrateOrganizer() {
  if (await timeSliceDb.meta.get(MIGRATION_ID)) {
    await repairOrganizerMirrors();
    return false;
  }
  const nowMs = Date.now();
  await transact(
    ["activityFolders", "activityDefinitions", "taskOccurrences", "tags"],
    async (revision) => {
      const collections = (await timeSliceDb.activityFolders.toArray())
        .map(normalizeActivityFolder)
        .filter((item): item is ActivityFolderRecord => Boolean(item));
      const definitions = (await timeSliceDb.activityDefinitions.toArray())
        .map(normalizeActivityDefinition)
        .filter((item): item is ActivityDefinitionRecord => Boolean(item));
      const occurrences = (await timeSliceDb.taskOccurrences.toArray())
        .map(normalizeTaskOccurrence)
        .filter((item): item is TaskOccurrenceRecord => Boolean(item));
      const conversion = convertOrganizerCollections({
        collections,
        definitions,
        occurrences,
        revision,
        nowMs,
      });
      if (conversion.collections.length)
        await timeSliceDb.activityFolders.bulkPut(conversion.collections);
      if (conversion.definitions.length)
        await timeSliceDb.activityDefinitions.bulkPut(conversion.definitions);
      if (conversion.occurrences.length)
        await timeSliceDb.taskOccurrences.bulkPut(conversion.occurrences);

      const definitionTags = definitions.flatMap((item) => item.tagIds || []);
      const occurrenceTags = occurrences.flatMap((item) => item.tagIds);
      const candidates = [
        ...legacyTagCandidates(),
        ...[...definitionTags, ...occurrenceTags].map((name) => ({
          name,
          source: "discovered" as const,
        })),
      ];
      const tags = buildOrganizerTagRegistry(candidates, revision, nowMs);
      if (tags.length) {
        await timeSliceDb.tags.bulkPut(
          tags.map((tag) => ({
            id: `${TAG_PREFIX}${tag.id}`,
            value: tag,
            revision,
            updatedAtMs: nowMs,
          })),
        );
      }
      await timeSliceDb.meta.put({
        id: MIGRATION_ID,
        value: {
          completedAtMs: nowMs,
          generatedListIds: conversion.generatedListIds,
        },
        revision,
        updatedAtMs: nowMs,
      });
      return true;
    },
  );
  await repairOrganizerMirrors();
  return true;
}

export type OrganizerSnapshot = {
  collections: ActivityFolderRecord[];
  definitions: ActivityDefinitionRecord[];
  areas: LifeAreaRecord[];
  occurrences: TaskOccurrenceRecord[];
  tags: OrganizerTagRecord[];
};

export async function readOrganizerSnapshot(): Promise<OrganizerSnapshot> {
  const [collections, definitions, areas, occurrences, tags] =
    await Promise.all([
      timeSliceDb.activityFolders.toArray(),
      timeSliceDb.activityDefinitions.toArray(),
      timeSliceDb.lifeAreas.toArray(),
      timeSliceDb.taskOccurrences.toArray(),
      listOrganizerTags(true),
    ]);
  return {
    collections: collections
      .map(normalizeActivityFolder)
      .filter((item): item is ActivityFolderRecord => Boolean(item)),
    definitions: definitions
      .map(normalizeActivityDefinition)
      .filter((item): item is ActivityDefinitionRecord => Boolean(item)),
    areas: areas
      .map(normalizeLifeArea)
      .filter((item): item is LifeAreaRecord => Boolean(item)),
    occurrences: occurrences
      .map(normalizeTaskOccurrence)
      .filter((item): item is TaskOccurrenceRecord => Boolean(item)),
    tags,
  };
}

export function subscribeOrganizer(onChange: () => void) {
  const subscription = liveQuery(readOrganizerSnapshot).subscribe({
    next: onChange,
    error: onChange,
  });
  const unsubscribeStorage = appStorage.subscribeExternal(() => onChange());
  return () => {
    subscription.unsubscribe();
    unsubscribeStorage();
  };
}

export async function createOrganizerTag(
  input: { name: string; color?: string },
  mutationId = crypto.randomUUID(),
) {
  const name = input.name.trim();
  if (!name) throw new TypeError("A tag name is required.");
  const normalizedName = normalizeTagName(name);
  const existing = (await listOrganizerTags(true)).find(
    (tag) => tag.normalizedName === normalizedName,
  );
  if (existing) return existing;
  const nowMs = Date.now();
  const id = `tag:${crypto.randomUUID()}`;
  const result = await transactIdempotent(
    ["tags"],
    {
      id: mutationId,
      fingerprint: JSON.stringify({ type: "create-organizer-tag", id, input }),
    },
    async (revision) => {
      const tag: OrganizerTagRecord = {
        id,
        name,
        normalizedName,
        color: input.color?.trim() || tagColor(name),
        aliases: [normalizedName],
        source: "custom",
        order: (await listOrganizerTags(true)).length,
        revision,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      await timeSliceDb.tags.put({
        id: `${TAG_PREFIX}${id}`,
        value: tag,
        revision,
        updatedAtMs: nowMs,
      });
      return tag;
    },
  );
  await repairOrganizerMirrors();
  return result.value;
}

export async function updateOrganizerTag(
  id: string,
  changes: { name?: string; color?: string; order?: number },
  expectedRevision: number,
  mutationId = crypto.randomUUID(),
) {
  const command = {
    type: "update-organizer-tag",
    id,
    changes,
    expectedRevision,
  };
  const result = await transactIdempotent(
    ["tags"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const wrapper = await timeSliceDb.tags.get(`${TAG_PREFIX}${id}`);
      const current = normalizeOrganizerTag(wrapper?.value);
      if (!current || current.revision !== expectedRevision)
        throw new Error("This tag changed in another window.");
      const name =
        changes.name === undefined ? current.name : changes.name.trim();
      if (!name) throw new TypeError("A tag name is required.");
      const normalizedName = normalizeTagName(name);
      const duplicate = (await listOrganizerTags(true)).find(
        (tag) => tag.id !== id && tag.normalizedName === normalizedName,
      );
      if (duplicate)
        throw new TypeError("A tag with this name already exists.");
      const updated: OrganizerTagRecord = {
        ...current,
        name,
        normalizedName,
        color: changes.color?.trim() || current.color,
        order:
          changes.order === undefined
            ? current.order
            : Math.max(0, Math.floor(changes.order)),
        aliases: [...new Set([...current.aliases, current.normalizedName])],
        revision,
        updatedAtMs: Date.now(),
      };
      await timeSliceDb.tags.put({
        id: `${TAG_PREFIX}${id}`,
        value: updated,
        revision,
        updatedAtMs: updated.updatedAtMs,
      });
      return updated;
    },
  );
  await repairOrganizerMirrors();
  return result.value;
}

export async function setOrganizerTagArchived(
  id: string,
  archived: boolean,
  expectedRevision: number,
  mutationId = crypto.randomUUID(),
) {
  const command = {
    type: "archive-organizer-tag",
    id,
    archived,
    expectedRevision,
  };
  const result = await transactIdempotent(
    ["tags"],
    { id: mutationId, fingerprint: JSON.stringify(command) },
    async (revision) => {
      const wrapper = await timeSliceDb.tags.get(`${TAG_PREFIX}${id}`);
      const current = normalizeOrganizerTag(wrapper?.value);
      if (!current || current.revision !== expectedRevision)
        throw new Error("This tag changed in another window.");
      const updated: OrganizerTagRecord = {
        ...current,
        archivedAtMs: archived ? Date.now() : undefined,
        revision,
        updatedAtMs: Date.now(),
      };
      await timeSliceDb.tags.put({
        id: `${TAG_PREFIX}${id}`,
        value: updated,
        revision,
        updatedAtMs: updated.updatedAtMs,
      });
      return updated;
    },
  );
  await repairOrganizerMirrors();
  return result.value;
}

export async function compatibilityCounts() {
  return {
    templates: parseArray("timeSliceActivityTemplates").length,
    categories: parseArray("timeSliceCustomCategories").length,
    legacyRpgTags: parseArray("timeSliceRPGTags").length,
  };
}

export const organizerMigrationId = MIGRATION_ID;
