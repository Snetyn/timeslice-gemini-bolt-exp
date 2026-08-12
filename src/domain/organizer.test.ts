import { describe, expect, it } from "vitest";
import type {
  ActivityDefinitionRecord,
  ActivityFolderRecord,
} from "./activityCatalog";
import {
  buildOrganizerTagRegistry,
  canonicalizeOrganizerTagIds,
  convertOrganizerCollections,
  matchesOrganizerTags,
  matchesOrganizerView,
} from "./organizer";
import type { TaskOccurrenceRecord } from "./taskPlanning";

const collection = (
  id: string,
  parentId: string | null,
): ActivityFolderRecord => ({
  id,
  name: id,
  normalizedName: id,
  kind: "list",
  color: "#fff",
  parentId,
  order: 0,
  revision: 1,
  createdAtMs: 1,
  updatedAtMs: 1,
});

const definition = (
  id: string,
  folderId: string | null,
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
    revision: 1,
    createdAtMs: 1,
    updatedAtMs: 1,
  }) as ActivityDefinitionRecord;

const occurrence = (
  id: string,
  folderId: string | null,
  tagIds: string[] = [],
): TaskOccurrenceRecord => ({
  id,
  activityDefinitionId: null,
  title: id,
  color: "#fff",
  tagIds,
  folderId,
  status: "inbox",
  localDate: null,
  schedulingMode: "flexible",
  exactStartMinutes: null,
  windowStartMinutes: null,
  windowEndMinutes: null,
  plannedDurationSeconds: 60,
  minimumDurationSeconds: 30,
  durationOverrideSeconds: null,
  durationMode: "fixed",
  placementStartMinutes: null,
  actualFocusedSeconds: 0,
  completedAtMs: null,
  completionSnapshot: null,
  skippedDueDates: [],
  recurrenceKey: null,
  revision: 1,
  createdAtMs: 1,
  updatedAtMs: 1,
});

describe("organizer domain", () => {
  it("converts structural nodes into folders and leaves into lists", () => {
    const converted = convertOrganizerCollections({
      collections: [collection("work", null), collection("projects", "work")],
      definitions: [definition("direct", "work")],
      occurrences: [occurrence("task", "projects")],
      revision: 2,
      nowMs: 2,
    });

    expect(converted.collections.find((item) => item.id === "work")?.kind).toBe(
      "folder",
    );
    expect(
      converted.collections.find((item) => item.id === "projects")?.kind,
    ).toBe("list");
    const generalId = converted.generatedListIds[0];
    expect(
      converted.collections.find((item) => item.id === generalId),
    ).toMatchObject({ name: "General", kind: "list", parentId: "work" });
    expect(converted.definitions[0].folderId).toBe(generalId);
    expect(converted.occurrences[0].folderId).toBe("projects");

    const repeated = convertOrganizerCollections({
      ...converted,
      revision: 3,
      nowMs: 3,
    });
    expect(repeated.generatedListIds).toEqual([]);
    expect(repeated.collections.map((item) => item.id)).toEqual(
      converted.collections.map((item) => item.id),
    );
  });

  it("detaches missing parents and cycles instead of losing their nodes", () => {
    const converted = convertOrganizerCollections({
      collections: [
        collection("a", "b"),
        collection("b", "a"),
        collection("orphan", "missing"),
      ],
      definitions: [],
      occurrences: [],
      revision: 2,
      nowMs: 2,
    });
    expect(converted.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "a", parentId: null, kind: "list" }),
        expect.objectContaining({ id: "b", parentId: null, kind: "list" }),
        expect.objectContaining({ id: "orphan", parentId: null }),
      ]),
    );
  });

  it("prefers RPG identity and retains legacy IDs and names as aliases", () => {
    const tags = buildOrganizerTagRegistry(
      [
        { id: "rpg-work", name: "Work", color: "#123", source: "rpg" },
        { id: "custom-work", name: "work", source: "custom" },
        { name: "rpg-work", source: "discovered" },
      ],
      2,
      2,
    );
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ id: "rpg-work", source: "rpg" });
    expect(tags[0].aliases).toEqual(
      expect.arrayContaining(["work", "custom-work"]),
    );
    expect(canonicalizeOrganizerTagIds(["work", "custom-work"], tags)).toEqual([
      "rpg-work",
    ]);
  });

  it("supports Any and All tag matching without changing task visibility", () => {
    const tags = buildOrganizerTagRegistry(
      [
        { id: "work", name: "Work", source: "rpg" },
        { id: "home", name: "Home", source: "rpg" },
      ],
      1,
      1,
    );
    expect(matchesOrganizerTags(["work"], ["work", "home"], "any", tags)).toBe(
      true,
    );
    expect(matchesOrganizerTags(["work"], ["work", "home"], "all", tags)).toBe(
      false,
    );
    expect(
      matchesOrganizerView(occurrence("one", null), "inbox", "2026-08-12"),
    ).toBe(true);
  });
});
