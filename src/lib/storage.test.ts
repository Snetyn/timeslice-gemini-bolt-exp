import { beforeEach, describe, expect, it } from "vitest";
import { appStorage, STORAGE_KEY } from "./storage";

describe("appStorage", () => {
  beforeEach(() => window.localStorage.clear());

  it("uses a single v2 envelope without touching legacy values", () => {
    window.localStorage.setItem("timeSliceActivities", '["legacy"]');
    appStorage.setItem("timeSliceActivities", '["new"]');

    expect(appStorage.getItem("timeSliceActivities")).toBe('["new"]');
    expect(window.localStorage.getItem("timeSliceActivities")).toBe(
      '["legacy"]',
    );
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
      version: 2,
      values: { timeSliceActivities: '["new"]' },
    });
  });
});
