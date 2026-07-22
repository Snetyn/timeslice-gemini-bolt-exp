import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { TimeSliceDatabase } from "./timesliceDb";

describe("TimeSlice database upgrades", () => {
  it("adds the catalog tables without rewriting earlier records", async () => {
    const name = `timeslice-upgrade-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
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
    legacy.version(2).stores({
      sessionRuns: "id, revision, updatedAtMs",
    });
    await legacy.open();
    await legacy.table("compatibility").put({
      id: "timeSliceSettings",
      value: '{"keep":true}',
      revision: 7,
      updatedAtMs: 1_000,
    });
    legacy.close();

    const upgraded = new TimeSliceDatabase(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(4);
    expect((await upgraded.compatibility.get("timeSliceSettings"))?.value).toBe(
      '{"keep":true}',
    );
    expect(upgraded.tables.map((table) => table.name)).toContain(
      "activitySessions",
    );
    expect(upgraded.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "lifeAreas",
        "activityFolders",
        "activityDefinitions",
        "decisionOpportunities",
        "decisionMomentum",
      ]),
    );
    upgraded.close();
    await Dexie.delete(name);
  });
});
