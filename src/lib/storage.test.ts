import { beforeEach, describe, expect, it } from "vitest";
import {
  appStorage,
  hydrateAppStorage,
  resetAppStorageForTests,
} from "./storage";
import { timeSliceDb } from "../data/timesliceDb";

describe("appStorage", () => {
  beforeEach(async () => {
    await resetAppStorageForTests();
    window.localStorage.clear();
  });

  it("imports legacy data without touching browser localStorage", async () => {
    window.localStorage.setItem("timeSliceActivities", '["legacy"]');
    await hydrateAppStorage();

    expect(appStorage.getItem("timeSliceActivities")).toBe('["legacy"]');
    expect(window.localStorage.getItem("timeSliceActivities")).toBe(
      '["legacy"]',
    );
    expect((await timeSliceDb.sessionActivities.get("all"))?.value).toBe(
      '["legacy"]',
    );
  });

  it("adds the Phase 1 ledger at database version 3", async () => {
    await hydrateAppStorage();
    expect(timeSliceDb.verno).toBe(3);
    expect(timeSliceDb.tables.map((table) => table.name)).toContain(
      "activitySessions",
    );
  });
});
