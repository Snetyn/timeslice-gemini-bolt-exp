import { describe, expect, it } from "vitest";
import {
  canMoveFolder,
  flattenFolderTree,
  isEffectivelyArchived,
  normalizeSearchName,
  type ActivityFolderRecord,
} from "./activityCatalog";

const folder = (
  id: string,
  parentId: string | null,
  order: number,
  archived = false,
): ActivityFolderRecord => ({
  id,
  name: id,
  normalizedName: id,
  parentId,
  order,
  revision: 1,
  createdAtMs: 1,
  updatedAtMs: 1,
  ...(archived ? { archivedAtMs: 2 } : {}),
});

describe("activity catalog domain", () => {
  it("normalizes names for searching without making them identities", () => {
    expect(normalizeSearchName("  Dog   walk ")).toBe("dog walk");
  });

  it("flattens deep folder trees iteratively in sibling order", () => {
    const folders = [
      folder("root", null, 0),
      folder("second", "root", 1),
      folder("first", "root", 0),
      folder("deep", "first", 0),
    ];
    expect(flattenFolderTree(folders).map(({ id, depth }) => [id, depth])).toEqual([
      ["root", 0],
      ["first", 1],
      ["deep", 2],
      ["second", 1],
    ]);
  });

  it("inherits archive state without rewriting descendants", () => {
    const folders = [folder("root", null, 0, true), folder("child", "root", 0)];
    expect(isEffectivelyArchived("child", folders)).toBe(true);
    expect(flattenFolderTree(folders)).toEqual([]);
    expect(flattenFolderTree(folders, true).find((item) => item.id === "child"))
      .toMatchObject({ effectivelyArchived: true });
  });

  it("rejects self, descendant, missing-parent, and cyclic moves", () => {
    const folders = [folder("root", null, 0), folder("child", "root", 0)];
    expect(canMoveFolder(folders, "root", "root")).toBe(false);
    expect(canMoveFolder(folders, "root", "child")).toBe(false);
    expect(canMoveFolder(folders, "child", "missing")).toBe(false);
    expect(canMoveFolder(folders, "child", null)).toBe(true);
  });
});
