import { describe, expect, it } from "vitest";
import {
  addSessionSubActivity,
  increaseSessionSubActivity,
  normalizeSessionHierarchy,
  previewSubActivityFunding,
  removeSessionSubActivity,
  reorderSessionHierarchy,
  type SessionHierarchyActivity,
} from "./sessionSubActivities";

const activity = (
  id: string,
  timeRemaining: number,
  extra: Partial<SessionHierarchyActivity> = {},
): SessionHierarchyActivity => ({
  id,
  name: id,
  color: "hsl(220, 70%, 50%)",
  duration: timeRemaining / 60,
  timeRemaining,
  originalPlannedSeconds: timeRemaining,
  percentage: 0,
  ...extra,
});

describe("Session sub-activities", () => {
  it("repairs orphan and nested hierarchy records without deleting them", () => {
    const result = normalizeSessionHierarchy([
      activity("parent", 600),
      activity("child", 60, { parentActivityId: "parent" }),
      activity("nested", 60, { parentActivityId: "child" }),
      activity("orphan", 60, { parentActivityId: "missing" }),
    ]);
    expect(result.map(({ id }) => id)).toEqual([
      "parent",
      "child",
      "nested",
      "orphan",
    ]);
    expect(result.find(({ id }) => id === "child")?.parentActivityId).toBe(
      "parent",
    );
    expect(result.find(({ id }) => id === "nested")?.parentActivityId).toBe(
      undefined,
    );
    expect(result.find(({ id }) => id === "orphan")?.parentActivityId).toBe(
      undefined,
    );
  });

  it("partitions a child directly from its parent's remaining allocation", () => {
    const source = [
      activity("parent", 600),
      activity("a", 100),
      activity("b", 200),
    ];
    const preview = previewSubActivityFunding({
      activities: source,
      parentId: "parent",
      requestedSeconds: 101,
    });
    expect(preview).toMatchObject({
      maximumSeconds: 600,
      fundedSeconds: 101,
      valid: true,
      donatedSecondsById: { parent: 101 },
    });
    const result = addSessionSubActivity({
      activities: source,
      parentId: "parent",
      child: { id: "kitchen", name: "Kitchen" },
      requestedSeconds: 101,
    });
    expect(result.activities.map(({ id }) => id)).toEqual([
      "parent",
      "kitchen",
      "a",
      "b",
    ]);
    expect(result.activities.map(({ timeRemaining }) => timeRemaining)).toEqual(
      [499, 101, 100, 200],
    );
    expect(
      result.activities.reduce(
        (sum, item) => sum + (item.timeRemaining || 0),
        0,
      ),
    ).toBe(900);
  });

  it("uses only the selected parent even when unrelated tasks are eligible", () => {
    const preview = previewSubActivityFunding({
      activities: [
        activity("parent", 600, { priority: true }),
        activity("protected-parent", 100, { priority: true }),
        activity("protected-child", 100, {
          parentActivityId: "protected-parent",
        }),
        activity("star", 100, { priority: true }),
        activity("locked", 100, { isLocked: true }),
      ],
      parentId: "parent",
      requestedSeconds: 100,
    });
    expect(preview.maximumSeconds).toBe(600);
    expect(preview.donatedSecondsById).toEqual({ parent: 100 });
  });

  it("respects donor minimums and exposes the actual maximum", () => {
    const preview = previewSubActivityFunding({
      activities: [activity("parent", 100), activity("a", 600)],
      parentId: "parent",
      requestedSeconds: 80,
      minimumDonorSeconds: 30,
    });
    expect(preview.maximumSeconds).toBe(70);
    expect(preview.valid).toBe(false);
    expect(preview.fundedSeconds).toBe(70);
  });

  it("restores remaining child allocation to its parent", () => {
    const created = addSessionSubActivity({
      activities: [
        activity("parent", 600),
        activity("a", 100),
        activity("b", 200),
      ],
      parentId: "parent",
      child: { id: "child", name: "Child" },
      requestedSeconds: 90,
    });
    const restored = removeSessionSubActivity({
      activities: created.activities.map((item) =>
        item.id === "a" ? { ...item, isCompleted: true } : item,
      ),
      childId: "child",
      vaultSeconds: 5,
    });
    expect(restored.activities.some(({ id }) => id === "child")).toBe(false);
    expect(restored.vaultSeconds).toBe(5);
    expect(
      restored.activities.reduce(
        (sum, item) => sum + (item.isCompleted ? 0 : item.timeRemaining || 0),
        0,
      ),
    ).toBeGreaterThan(0);
    expect(restored.restoredSecondsById).toEqual({ parent: 90 });
    expect(
      restored.activities.find(({ id }) => id === "parent")?.timeRemaining,
    ).toBe(600);
  });

  it("reactivates a completed parent when a child returns unused time", () => {
    const created = addSessionSubActivity({
      activities: [activity("parent", 100)],
      parentId: "parent",
      child: { id: "child", name: "Child" },
      requestedSeconds: 40,
    });
    const restored = removeSessionSubActivity({
      activities: created.activities.map((item) =>
        item.id === "parent"
          ? {
              ...item,
              timeRemaining: 0,
              isCompleted: true,
              ownTimerCompleted: true,
              completedElapsedSeconds: 60,
            }
          : item,
      ),
      childId: "child",
      vaultSeconds: 0,
    });

    expect(restored.activities.find(({ id }) => id === "parent")).toMatchObject(
      {
        timeRemaining: 40,
        isCompleted: false,
        ownTimerCompleted: false,
        completedElapsedSeconds: undefined,
      },
    );
    expect(restored.vaultSeconds).toBe(0);
  });

  it("increases a child by shrinking the parent again", () => {
    const created = addSessionSubActivity({
      activities: [activity("parent", 100), activity("donor", 200)],
      parentId: "parent",
      child: { id: "child", name: "Child" },
      requestedSeconds: 40,
    });
    const increased = increaseSessionSubActivity({
      activities: created.activities,
      childId: "child",
      requestedSeconds: 30,
    });
    expect(increased.activities.find(({ id }) => id === "child")).toMatchObject(
      {
        timeRemaining: 70,
        originalPlannedSeconds: 70,
        subActivityFunding: {
          fundedSeconds: 70,
          donatedSecondsById: { parent: 70 },
        },
      },
    );
    expect(
      increased.activities.find(({ id }) => id === "parent")?.timeRemaining,
    ).toBe(30);
    expect(
      increased.activities.find(({ id }) => id === "donor")?.timeRemaining,
    ).toBe(200);
  });

  it("moves top-level families together and only reorders children within a family", () => {
    const source = [
      activity("a", 100),
      activity("a1", 10, { parentActivityId: "a" }),
      activity("a2", 10, { parentActivityId: "a" }),
      activity("b", 100),
    ];
    expect(
      reorderSessionHierarchy(source, "b", "a").map(({ id }) => id),
    ).toEqual(["b", "a", "a1", "a2"]);
    expect(
      reorderSessionHierarchy(source, "a2", "a1").map(({ id }) => id),
    ).toEqual(["a", "a2", "a1", "b"]);
    expect(
      reorderSessionHierarchy(source, "a1", "b").map(({ id }) => id),
    ).toEqual(source.map(({ id }) => id));
  });
});
