import { normalizeSearchName, type ActivityDefinitionRecord } from "../domain/activityCatalog";
import { timeSliceDb, transact, type TimeSliceDatabase } from "./timesliceDb";

const CATALOG_IMPORT_META_ID = "activity-catalog-import-v4";

type LegacyActivity = {
  id?: unknown;
  sharedId?: unknown;
  name?: unknown;
  color?: unknown;
  priority?: unknown;
};

const parseArray = (value?: string) => {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as LegacyActivity[]) : [];
  } catch {
    return [];
  }
};

const sourceIdentity = (mode: string, activity: LegacyActivity, index: number) => {
  const sharedId = typeof activity.sharedId === "string" && activity.sharedId.trim();
  if (sharedId) return `shared:${sharedId}`;
  const id = typeof activity.id === "string" && activity.id.trim();
  return `${mode}:${id || `index-${index}`}`;
};

const deterministicId = (sourceKey: string) => `legacy:${encodeURIComponent(sourceKey)}`;

/**
 * Creates reusable definitions only from stable legacy source identities.
 * Names are deliberately never used as identity and old stores stay untouched.
 */
export async function migrateActivityCatalog(db: TimeSliceDatabase = timeSliceDb) {
  if (await db.meta.get(CATALOG_IMPORT_META_ID)) return false;
  const compatibility = Object.fromEntries(
    (await db.compatibility.toArray()).map((record) => [record.id, record.value]),
  );
  const sources = [
    ["session", "timeSliceActivities"],
    ["daily", "timeSliceDailyActivities"],
    ["template", "timeSliceActivityTemplates"],
  ] as const;
  const candidates = sources.flatMap(([mode, key]) =>
    parseArray(compatibility[key]).map((activity, index) => ({
      activity,
      sourceKey: sourceIdentity(mode, activity, index),
    })),
  );
  const nowMs = Date.now();

  await transact(
    ["activityDefinitions"],
    async (revision) => {
      const existing = await db.activityDefinitions.toArray();
      const bySource = new Map(
        existing.flatMap((definition) =>
          definition.sourceKeys.map((key) => [key, definition] as const),
        ),
      );
      const created: ActivityDefinitionRecord[] = [];
      for (const { activity, sourceKey } of candidates) {
        const name = typeof activity.name === "string" ? activity.name.trim() : "";
        if (!name) continue;
        const known = bySource.get(sourceKey);
        if (known) continue;
        const definition: ActivityDefinitionRecord = {
          id: deterministicId(sourceKey),
          name,
          normalizedName: normalizeSearchName(name),
          aliases: [],
          sourceKeys: [sourceKey],
          color:
            typeof activity.color === "string" && activity.color.trim()
              ? activity.color
              : "#3b82f6",
          lifeAreaId: null,
          folderId: null,
          order: existing.length + created.length,
          protected: Boolean(activity.priority),
          decisionType: "normal",
          revision,
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        };
        created.push(definition);
        bySource.set(sourceKey, definition);
      }
      if (created.length) await db.activityDefinitions.bulkPut(created);
      await db.meta.put({
        id: CATALOG_IMPORT_META_ID,
        value: { completedAtMs: nowMs, createdIds: created.map((item) => item.id) },
        revision,
        updatedAtMs: nowMs,
      });
    },
    db,
  );
  return true;
}
