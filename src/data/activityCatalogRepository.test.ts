import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptLegacyHistory,
  createActivityDefinition,
  createFolder,
  createLifeArea,
  findDefinitionsByName,
  moveFolder,
  previewLegacyHistoryCandidates,
  setFolderArchived,
  updateActivityDefinition,
  updateLifeArea,
} from "./activityCatalogRepository";
import { flattenFolderTree } from "../domain/activityCatalog";
import { timeSliceDb } from "./timesliceDb";

describe("activity catalog repository", () => {
  beforeEach(async () => {
    timeSliceDb.close();
    await timeSliceDb.delete();
    await timeSliceDb.open();
  });

  it("allows same-name definitions while keeping source identities distinct", async () => {
    await createActivityDefinition({ name: "Reading", sourceKeys: ["template:first"] });
    await createActivityDefinition({ name: "Reading", sourceKeys: ["daily:second"] });
    const matches = await findDefinitionsByName(" reading ");
    expect(matches).toHaveLength(2);
    expect(matches.map((item) => item.sourceKeys)).toEqual([
      ["template:first"],
      ["daily:second"],
    ]);
  });

  it("rejects folder cycles transactionally", async () => {
    const parent = (await createFolder({ name: "Parent" })).value;
    const child = (await createFolder({ name: "Child", parentId: parent.id })).value;
    await expect(moveFolder(parent.id, child.id, parent.revision)).rejects.toThrow(
      "invalid tree",
    );
  });

  it("updates future catalog metadata without rewriting recorded snapshots", async () => {
    const area = (await createLifeArea({ name: "Work", color: "#111111" })).value;
    const definition = (
      await createActivityDefinition({ name: "Build", lifeAreaId: area.id })
    ).value;
    await timeSliceDb.activitySessions.add({
      id: "recorded",
      sourceTimerId: "single",
      activityId: "build",
      activityName: "Build",
      activityDefinitionId: definition.id,
      lifeAreaId: area.id,
      lifeAreaName: area.name,
      lifeAreaColor: area.color,
      source: "single",
      kind: "standard",
      status: "completed",
      startedAtMs: 1,
      endedAtMs: 2,
      durationMs: 1,
      corrections: [],
      classificationCorrections: [],
      revision: 1,
      createdAtMs: 1,
      updatedAtMs: 2,
    });
    const renamed = (
      await updateActivityDefinition(definition.id, { name: "Build app" }, definition.revision)
    ).value;
    await updateLifeArea(area.id, { name: "Career" }, area.revision);
    expect(renamed.aliases).toContain("build");
    expect(await timeSliceDb.activitySessions.get("recorded")).toMatchObject({
      activityName: "Build",
      lifeAreaName: "Work",
    });
  });

  it("archives a folder subtree by inheritance without rewriting descendants", async () => {
    const parent = (await createFolder({ name: "Parent" })).value;
    const child = (await createFolder({ name: "Child", parentId: parent.id })).value;
    await setFolderArchived(parent.id, true, parent.revision);
    const storedChild = await timeSliceDb.activityFolders.get(child.id);
    expect(storedChild?.archivedAtMs).toBeUndefined();
    expect(flattenFolderTree(await timeSliceDb.activityFolders.toArray(), true)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: child.id, effectivelyArchived: true }),
      ]),
    );
  });

  it("previews name candidates but mutates only explicitly selected source groups", async () => {
    const area = (await createLifeArea({ name: "Learning", color: "#8b5cf6" })).value;
    const definition = (
      await createActivityDefinition({ name: "Reading", lifeAreaId: area.id })
    ).value;
    await timeSliceDb.activitySessions.bulkAdd([
      {
        id: "one",
        sourceTimerId: "session",
        activityId: "session-reading",
        activityName: "Reading",
        source: "session",
        kind: "countdown",
        status: "completed",
        startedAtMs: 1_000,
        endedAtMs: 61_000,
        durationMs: 60_000,
        corrections: [],
        classificationCorrections: [],
        revision: 1,
        createdAtMs: 1_000,
        updatedAtMs: 61_000,
      },
      {
        id: "two",
        sourceTimerId: "daily:reading",
        activityId: "daily-reading",
        activityName: "Reading",
        source: "daily",
        kind: "standard",
        status: "completed",
        startedAtMs: 2_000,
        endedAtMs: 122_000,
        durationMs: 120_000,
        corrections: [],
        classificationCorrections: [],
        revision: 1,
        createdAtMs: 2_000,
        updatedAtMs: 122_000,
      },
    ]);

    const candidates = await previewLegacyHistoryCandidates(definition.id);
    expect(candidates).toHaveLength(2);
    await adoptLegacyHistory(definition.id, ["session:session-reading"], "adopt-one");
    const records = await timeSliceDb.activitySessions.toArray();
    expect(records.find((item) => item.id === "one")).toMatchObject({
      activityDefinitionId: definition.id,
      lifeAreaId: area.id,
      classificationSource: "legacy-adoption",
    });
    expect(records.find((item) => item.id === "two")?.activityDefinitionId).toBeUndefined();

    await adoptLegacyHistory(definition.id, ["session:session-reading"], "adopt-one");
    expect((await timeSliceDb.activitySessions.get("one"))?.classificationCorrections).toHaveLength(1);
  });
});
