import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { migrateActivityCatalog } from "./migrateActivityCatalog";
import { TimeSliceDatabase } from "./timesliceDb";

describe("activity catalog migration", () => {
  it("keeps same-name stable sources separate and reuses shared identities", async () => {
    const name = `catalog-migration-${crypto.randomUUID()}`;
    const db = new TimeSliceDatabase(name);
    await db.open();
    await db.compatibility.bulkPut([
      {
        id: "timeSliceActivities",
        value: JSON.stringify([
          { id: "one", name: "Reading", color: "#111111" },
          { id: "two", name: "Reading", color: "#222222" },
          { id: "shared-session", sharedId: "shared", name: "Shared" },
        ]),
        revision: 1,
        updatedAtMs: 1,
      },
      {
        id: "timeSliceDailyActivities",
        value: JSON.stringify([
          { id: "shared-daily", sharedId: "shared", name: "Shared renamed" },
        ]),
        revision: 1,
        updatedAtMs: 1,
      },
    ]);

    await migrateActivityCatalog(db);
    const definitions = await db.activityDefinitions.orderBy("order").toArray();
    expect(definitions).toHaveLength(3);
    expect(definitions.filter((item) => item.normalizedName === "reading")).toHaveLength(2);
    expect(definitions.filter((item) => item.sourceKeys.includes("shared:shared"))).toHaveLength(1);
    expect(await migrateActivityCatalog(db)).toBe(false);
    expect(await db.activityDefinitions.count()).toBe(3);
    db.close();
    await Dexie.delete(name);
  });
});
