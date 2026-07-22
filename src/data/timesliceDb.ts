import Dexie, { type EntityTable } from "dexie";
import type { TimerState } from "../domain/timer";
import type { PersistedSessionRun } from "../domain/sessionSnapshot";
import type { ActivitySessionRecord } from "../domain/activitySession";
import type {
  ActivityDefinitionRecord,
  ActivityFolderRecord,
  LifeAreaRecord,
} from "../domain/activityCatalog";
import type {
  DecisionMomentumRecord,
  DecisionOpportunityRecord,
} from "../domain/decisionMomentum";

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

type TransactionTable = keyof Pick<
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
  | "sessionRuns"
  | "activitySessions"
  | "lifeAreas"
  | "activityFolders"
  | "activityDefinitions"
  | "decisionOpportunities"
  | "decisionMomentum"
  | "compatibility"
  | "meta"
>;

export class MutationIdConflictError extends Error {
  constructor() {
    super("This mutation ID has already been used for a different command.");
    this.name = "MutationIdConflictError";
  }
}

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
  sessionRuns!: EntityTable<VersionedRecord<PersistedSessionRun>, "id">;
  activitySessions!: EntityTable<ActivitySessionRecord, "id">;
  lifeAreas!: EntityTable<LifeAreaRecord, "id">;
  activityFolders!: EntityTable<ActivityFolderRecord, "id">;
  activityDefinitions!: EntityTable<ActivityDefinitionRecord, "id">;
  decisionOpportunities!: EntityTable<DecisionOpportunityRecord, "id">;
  decisionMomentum!: EntityTable<DecisionMomentumRecord, "id">;
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
    this.version(2).stores({
      sessionRuns: "id, revision, updatedAtMs",
    });
    this.version(3).stores({
      activitySessions:
        "id, sourceTimerId, status, activityId, startedAtMs, endedAtMs, updatedAtMs, [sourceTimerId+status]",
    });
    this.version(4).stores({
      lifeAreas: "id, normalizedName, archivedAtMs, order, updatedAtMs",
      activityFolders: "id, parentId, archivedAtMs, order, updatedAtMs",
      activityDefinitions:
        "id, normalizedName, lifeAreaId, folderId, archivedAtMs, order, updatedAtMs, *sourceKeys",
      decisionOpportunities: "id, status, reason, createdAtMs, updatedAtMs",
      decisionMomentum:
        "id, &decisionOpportunityId, activityDefinitionId, lifeAreaId, confirmedAtMs, updatedAtMs",
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
  tables: TransactionTable[],
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

type StoredMutation<T> = {
  fingerprint: string;
  result: T;
};

/**
 * Runs a mutation once. Replaying the same ID and fingerprint returns the
 * original result without touching either the workspace or entity revision.
 */
export async function transactIdempotent<T>(
  tables: TransactionTable[],
  mutation: { id: string; fingerprint: string },
  mutate: (revision: number) => Promise<T>,
  db = timeSliceDb,
): Promise<{ value: T; revision: number; replayed: boolean }> {
  const transaction = db.transaction.bind(db) as unknown as (
    mode: "rw",
    ...args: Array<unknown>
  ) => Promise<{ value: T; revision: number; replayed: boolean }>;
  return transaction(
    "rw",
    ...tables.map((table) => db[table]),
    db.meta,
    async () => {
      const mutationRecordId = `mutation:${mutation.id}`;
      const existing = await db.meta.get(mutationRecordId);
      if (existing) {
        const stored = existing.value as Partial<StoredMutation<T>>;
        if (
          stored.fingerprint !== mutation.fingerprint ||
          !("result" in stored)
        ) {
          throw new MutationIdConflictError();
        }
        return {
          value: stored.result as T,
          revision: existing.revision,
          replayed: true,
        };
      }

      const current =
        ((await db.meta.get(WORKSPACE_REVISION_ID))?.value as
          | number
          | undefined) || 0;
      const revision = current + 1;
      const value = await mutate(revision);
      const updatedAtMs = Date.now();
      await db.meta.put({
        id: mutationRecordId,
        value: { fingerprint: mutation.fingerprint, result: value },
        revision,
        updatedAtMs,
      });
      await db.meta.put({
        id: WORKSPACE_REVISION_ID,
        value: revision,
        revision,
        updatedAtMs,
      });
      return { value, revision, replayed: false };
    },
  );
}
