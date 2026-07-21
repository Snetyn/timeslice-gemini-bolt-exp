import Dexie, { type EntityTable } from "dexie";
import type { TimerState } from "../domain/timer";

export type VersionedRecord<T> = {
  id: string;
  value: T;
  revision: number;
  updatedAtMs: number;
};

export type MetaRecord = VersionedRecord<unknown>;

export type SessionHistoryRecord = VersionedRecord<{
  completedAtMs: number;
  report: unknown;
}>;

export class TimeSliceDatabase extends Dexie {
  settings!: EntityTable<VersionedRecord<unknown>, "id">;
  sessionActivities!: EntityTable<VersionedRecord<unknown>, "id">;
  dailyActivities!: EntityTable<VersionedRecord<unknown>, "id">;
  tags!: EntityTable<VersionedRecord<unknown>, "id">;
  templates!: EntityTable<VersionedRecord<unknown>, "id">;
  categories!: EntityTable<VersionedRecord<unknown>, "id">;
  counters!: EntityTable<VersionedRecord<unknown>, "id">;
  timers!: EntityTable<VersionedRecord<TimerState>, "id">;
  sessionReports!: EntityTable<SessionHistoryRecord, "id">;
  compatibility!: EntityTable<VersionedRecord<string>, "id">;
  meta!: EntityTable<MetaRecord, "id">;

  constructor(name = "timeslice") {
    super(name);
    this.version(1).stores({
      settings: "id, revision, updatedAtMs",
      sessionActivities: "id, revision, updatedAtMs",
      dailyActivities: "id, revision, updatedAtMs",
      tags: "id, revision, updatedAtMs",
      templates: "id, revision, updatedAtMs",
      categories: "id, revision, updatedAtMs",
      counters: "id, revision, updatedAtMs",
      timers: "id, revision, updatedAtMs",
      sessionReports: "id, completedAtMs, revision, updatedAtMs",
      compatibility: "id, revision, updatedAtMs",
      meta: "id, revision, updatedAtMs",
    });
  }
}

export const timeSliceDb = new TimeSliceDatabase();

export const WORKSPACE_REVISION_ID = "workspace-revision";

export const readWorkspaceRevision = async (db = timeSliceDb) =>
  (await db.meta.get(WORKSPACE_REVISION_ID))?.value as number | undefined;

/**
 * Serializes a mutation with the workspace revision. IndexedDB transactions
 * are atomic even when Web Locks are unavailable.
 */
export async function transact<T>(
  tables: Array<
    keyof Pick<
      TimeSliceDatabase,
      | "settings"
      | "sessionActivities"
      | "dailyActivities"
      | "tags"
      | "templates"
      | "categories"
      | "counters"
      | "timers"
      | "sessionReports"
      | "compatibility"
      | "meta"
    >
  >,
  mutate: (revision: number) => Promise<T>,
  db = timeSliceDb,
): Promise<{ value: T; revision: number }> {
  const transaction = db.transaction.bind(db) as unknown as (
    mode: "rw",
    ...args: Array<unknown>
  ) => Promise<{ value: T; revision: number }>;
  return transaction(
    "rw",
    ...tables.map((table) => db[table]),
    db.meta,
    async () => {
      const current =
        ((await db.meta.get(WORKSPACE_REVISION_ID))?.value as
          number | undefined) || 0;
      const revision = current + 1;
      const value = await mutate(revision);
      await db.meta.put({
        id: WORKSPACE_REVISION_ID,
        value: revision,
        revision,
        updatedAtMs: Date.now(),
      });
      return { value, revision };
    },
  );
}
