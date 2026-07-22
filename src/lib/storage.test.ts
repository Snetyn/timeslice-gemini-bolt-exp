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

  it("keeps the Phase 0 database schema at version 2", async () => {
    await hydrateAppStorage();
    expect(timeSliceDb.verno).toBe(2);
  });
});
