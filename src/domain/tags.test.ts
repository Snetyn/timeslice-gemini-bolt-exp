import { describe, expect, it } from "vitest";
import {
  buildCanonicalTags,
  applyTagsToLinkedActivities,
  isTagAssigned,
  normalizeAssignedTags,
  normalizeTagName,
  setTagAssignment,
  tagColor,
} from "./tags";

describe("tags", () => {
  it("normalizes malformed persisted values without throwing", () => {
    expect(normalizeTagName(null)).toBe("");
    expect(normalizeAssignedTags([" Work ", null, 2, "work", ""])).toEqual([
      "Work",
    ]);
    expect(normalizeAssignedTags({ tags: ["work"] })).toEqual([]);
  });

  it("prefers RPG tags when names collide", () => {
    const tags = buildCanonicalTags({
      rpgTags: [
        { id: "r1", name: "Work", color: "#123456" },
        { id: null, name: "Broken" },
      ],
      customTags: ["work", "Home", null],
      templates: [{ tags: ["HOME", "Reading"] }],
    });
    expect(tags.find((tag) => tag.name === "Work")).toMatchObject({
      source: "rpg",
      storageValue: "r1",
      color: "#123456",
      aliases: ["work"],
    });
    expect(
      tags.filter((tag) => normalizeTagName(tag.name) === "work"),
    ).toHaveLength(1);
    expect(tags.map((tag) => normalizeTagName(tag.name))).toEqual([
      "home",
      "reading",
      "work",
    ]);
  });

  it("recognizes legacy names and canonical IDs when toggling", () => {
    const tag = {
      name: "Deep Work",
      storageValue: "r1",
      aliases: ["work", "old-work-id"],
    };
    expect(isTagAssigned(["work"], tag)).toBe(true);
    expect(isTagAssigned(["old-work-id"], tag)).toBe(true);
    expect(setTagAssignment(["work", "home"], tag, true)).toEqual([
      "home",
      "r1",
    ]);
    expect(setTagAssignment(["r1", "home"], tag, false)).toEqual(["home"]);
  });

  it("produces stable colors", () => {
    expect(tagColor("Planning")).toBe(tagColor(" planning "));
    expect(tagColor("Planning")).toMatch(/^hsl\(/);
  });

  it("updates every row linked to the same shared activity", () => {
    const activities = [
      { id: "session", sharedId: "shared", tags: [] },
      { id: "daily", sharedId: "shared", tags: ["old"] },
      { id: "other", tags: ["keep"] },
    ];
    expect(
      applyTagsToLinkedActivities(activities, "session", "shared", [
        "work",
        null,
      ]),
    ).toEqual([
      { id: "session", sharedId: "shared", tags: ["work"] },
      { id: "daily", sharedId: "shared", tags: ["work"] },
      { id: "other", tags: ["keep"] },
    ]);
  });
});
