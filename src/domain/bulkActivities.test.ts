import { describe, expect, it } from "vitest";
import {
  bulkActivityColor,
  createBulkActivityId,
  parseBulkActivities,
} from "./bulkActivities";

describe("bulk activity entry", () => {
  it("splits commas, dashes, and line breaks", () => {
    expect(
      parseBulkActivities("cleaning, walking the dog-gaming\nreading").names,
    ).toEqual(["cleaning", "walking the dog", "gaming", "reading"]);
  });

  it("preserves quoted separators and escaped quotes", () => {
    expect(
      parseBulkActivities('"pre-work planning", "say ""hello"""').names,
    ).toEqual(["pre-work planning", 'say "hello"']);
  });

  it("silently deduplicates pasted and existing names", () => {
    expect(
      parseBulkActivities("Walk, walk, Game, Existing", ["existing"]),
    ).toEqual({
      names: ["Walk", "Game"],
      duplicateCount: 2,
    });
  });

  it("handles empty and Unicode values", () => {
    expect(parseBulkActivities(" , - séta, TAKARÍTÁS ").names).toEqual([
      "séta",
      "TAKARÍTÁS",
    ]);
  });

  it("creates deterministic colors and collision-safe injected IDs", () => {
    expect(bulkActivityColor("Walk", 1)).toBe(bulkActivityColor("Walk", 1));
    expect(createBulkActivityId("daily", 0, "one")).not.toBe(
      createBulkActivityId("daily", 1, "two"),
    );
  });
});
