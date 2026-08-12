import { beforeEach, describe, expect, it } from "vitest";
import type {
  ActivityDefinitionRecord,
  ActivityFolderRecord,
} from "../domain/activityCatalog";
import {
  createOrganizerTag,
  migrateOrganizer,
  organizerMigrationId,
  readOrganizerSnapshot,
  setOrganizerTagArchived,
  updateOrganizerTag,
} from "./organizerRepository";
import { timeSliceDb } from "./timesliceDb";

const legacyCollection = (
  id: string,
  parentId: string | null,
): ActivityFolderRecord =>
  ({
    id,
    name: id,
    normalizedName: id,
    parentId,
    order: 0,
    revision: 1,
    createdAtMs: 1,
    updatedAtMs: 1,
  }) as ActivityFolderRecord;

const legacyDefinition = (
  id: string,
  folderId: string,
): ActivityDefinitionRecord =>
  ({
    id,
    name: id,
    normalizedName: id,
    aliases: [],
    sourceKeys: [],
    color: "#fff",
    lifeAreaId: null,
    folderId,
    order: 0,
    protected: false,
    decisionType: "normal",
    tagIds: ["old-work"],
    revision: 1,
    createdAtMs: 1,
    updatedAtMs: 1,
  }) as ActivityDefinitionRecord;

describe("organizer repository", () => {
  beforeEach(async () => {
    timeSliceDb.close();
    await timeSliceDb.delete();
    await timeSliceDb.open();
  });

  it("runs organizer-v1 once in database version 5 without deleting records", async () => {
    await timeSliceDb.activityFolders.bulkAdd([
      legacyCollection("home", null),
      legacyCollection("chores", "home"),
    ]);
    await timeSliceDb.activityDefinitions.add(
      legacyDefinition("cleaning", "home"),
    );
    await timeSliceDb.compatibility.put({
      id: "legacy-value",
      value: "untouched",
      revision: 1,
      updatedAtMs: 1,
    });

    expect(await migrateOrganizer()).toBe(true);
    const snapshot = await readOrganizerSnapshot();
    expect(timeSliceDb.verno).toBe(5);
    expect(snapshot.collections.find((item) => item.id === "home")?.kind).toBe(
      "folder",
    );
    expect(snapshot.definitions[0].folderId).toMatch(/^organizer-general:/);
    expect((await timeSliceDb.compatibility.get("legacy-value"))?.value).toBe(
      "untouched",
    );
    expect(await timeSliceDb.meta.get(organizerMigrationId)).toBeTruthy();
    expect(await migrateOrganizer()).toBe(false);
    expect(
      (await readOrganizerSnapshot()).collections.filter(
        (item) => item.name === "General",
      ),
    ).toHaveLength(1);
  });

  it("keeps tag identity through rename, archive, and restore", async () => {
    await migrateOrganizer();
    const created = await createOrganizerTag({
      name: "Work",
      color: "#123456",
    });
    const renamed = await updateOrganizerTag(
      created.id,
      { name: "Deep Work", color: "#654321", order: 4 },
      created.revision,
    );
    expect(renamed).toMatchObject({
      id: created.id,
      name: "Deep Work",
      color: "#654321",
      order: 4,
    });
    expect(renamed.aliases).toContain("work");

    const archived = await setOrganizerTagArchived(
      renamed.id,
      true,
      renamed.revision,
    );
    expect(archived.archivedAtMs).toBeTypeOf("number");
    const restored = await setOrganizerTagArchived(
      archived.id,
      false,
      archived.revision,
    );
    expect(restored.archivedAtMs).toBeUndefined();
  });
});
