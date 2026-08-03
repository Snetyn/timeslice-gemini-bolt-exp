import { describe, expect, it } from "vitest";
import { buildDailyTagWheels, resolveTagId } from "./dailyTagWheel";

const tags = [
  { id: "work", name: "Work", color: "#2563eb" },
  { id: "health", name: "Health", color: "#16a34a" },
];
const activities = [
  {
    id: "shared",
    name: "Shared",
    color: "#7c3aed",
    tagIds: ["work", "health"],
    plannedSeconds: 600,
    actualSeconds: 300,
  },
  {
    id: "work-only",
    name: "Work only",
    color: "#db2777",
    tagIds: ["work"],
    plannedSeconds: 300,
    actualSeconds: 900,
  },
];

describe("Daily tag wheel model", () => {
  it("resolves both stable ids and human tag names", () => {
    expect(resolveTagId("WORK", tags)).toBe("work");
    expect(resolveTagId("Health", tags)).toBe("health");
  });

  it("ignores malformed runtime tag values", () => {
    const malformed = [
      ...tags,
      { id: null, name: "Broken", color: "#000" },
      { id: "bad", name: undefined, color: "#000" },
    ] as unknown as typeof tags;
    expect(resolveTagId(null, malformed)).toBe("");
    expect(
      buildDailyTagWheels({
        activities: [
          {
            id: "a",
            name: "A",
            color: "#000",
            tagIds: null as unknown as string[],
            plannedSeconds: 10,
            actualSeconds: 5,
          },
        ],
        tags: malformed,
        selectedTagIds: ["bad"],
        metric: "plan",
        layout: "per-tag",
      }),
    ).toEqual([{ id: "bad", title: "bad", totalSeconds: 0, segments: [] }]);
  });

  it("builds one activity wheel for each selected tag", () => {
    const wheels = buildDailyTagWheels({
      activities,
      tags,
      selectedTagIds: ["work", "health"],
      metric: "plan",
      layout: "per-tag",
    });
    expect(wheels.map((wheel) => [wheel.id, wheel.totalSeconds])).toEqual([
      ["work", 900],
      ["health", 600],
    ]);
    expect(wheels[0].segments.map((segment) => segment.id)).toEqual([
      "shared",
      "work-only",
    ]);
  });

  it("splits multi-tag activity time in the combined wheel", () => {
    const [wheel] = buildDailyTagWheels({
      activities,
      tags,
      selectedTagIds: ["work", "health"],
      metric: "actual",
      layout: "combined",
    });
    expect(wheel.totalSeconds).toBe(1_200);
    expect(
      wheel.segments.map((segment) => [segment.id, segment.seconds]),
    ).toEqual([
      ["work", 1_050],
      ["health", 150],
    ]);
    expect(
      wheel.segments.reduce((sum, segment) => sum + segment.share, 0),
    ).toBeCloseTo(1);
  });

  it("returns neutral zero-share segments without invalid geometry", () => {
    const [wheel] = buildDailyTagWheels({
      activities: activities.map((activity) => ({
        ...activity,
        plannedSeconds: Number.NaN,
        actualSeconds: 0,
      })),
      tags,
      selectedTagIds: ["work"],
      metric: "plan",
      layout: "combined",
    });
    expect(wheel.totalSeconds).toBe(0);
    expect(wheel.segments[0].share).toBe(0);
  });
});
