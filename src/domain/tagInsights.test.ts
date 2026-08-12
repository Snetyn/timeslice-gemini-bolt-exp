import { describe, expect, it } from "vitest";
import type { ActivityDefinitionRecord } from "./activityCatalog";
import type { ActivitySessionRecord } from "./activitySession";
import { buildTagRatioModel, buildTagRpgLevels } from "./tagInsights";

const tags = [
  { id: "work", name: "Work", color: "#2563eb" },
  { id: "health", name: "Health", color: "#10b981" },
  { id: "fun", name: "Fun", color: "#a855f7" },
];

const definition = (
  changes: Partial<ActivityDefinitionRecord> = {},
): ActivityDefinitionRecord => ({
  id: "definition",
  name: "Focus",
  normalizedName: "focus",
  aliases: [],
  sourceKeys: ["shared:focus"],
  color: "#2563eb",
  lifeAreaId: null,
  folderId: null,
  order: 0,
  protected: false,
  decisionType: "normal",
  tagIds: ["work"],
  revision: 1,
  createdAtMs: 1,
  updatedAtMs: 1,
  ...changes,
});

const record = (
  changes: Partial<ActivitySessionRecord> = {},
): ActivitySessionRecord => ({
  id: "record",
  sourceTimerId: "session",
  activityId: "focus",
  activityName: "Focus",
  activityDefinitionId: "definition",
  sourceKey: "shared:focus",
  source: "session",
  kind: "countdown",
  status: "completed",
  startedAtMs: 1_000,
  endedAtMs: 61_000,
  durationMs: 60_000,
  corrections: [],
  classificationCorrections: [],
  revision: 1,
  createdAtMs: 1_000,
  updatedAtMs: 61_000,
  ...changes,
});

describe("tag ratio insights", () => {
  it("keeps renamed canonical tags connected through legacy aliases", () => {
    const renamed = [
      {
        id: "tag:stable",
        name: "Deep Work",
        color: "#2563eb",
        aliases: ["work", "old-work-id"],
      },
    ];
    const model = buildTagRatioModel({
      tags: renamed,
      selectedTagIds: ["tag:stable"],
      metric: "plan",
      matchMode: "any",
      activities: [
        {
          id: "legacy",
          tagIds: ["old-work-id"],
          planSeconds: 600,
          remainingSeconds: 600,
          actualSeconds: 0,
        },
      ],
    });
    expect(model.totalSeconds).toBe(600);
    expect(model.segments[0]).toMatchObject({
      id: "tag:stable",
      name: "Deep Work",
    });
  });

  it("splits multi-tag time evenly and keeps an honest 100 percent total", () => {
    const model = buildTagRatioModel({
      tags,
      selectedTagIds: ["work", "health"],
      metric: "plan",
      matchMode: "any",
      activities: [
        {
          id: "both",
          tagIds: ["work", "health"],
          planSeconds: 600,
          remainingSeconds: 300,
          actualSeconds: 300,
        },
        {
          id: "work",
          tagIds: ["work"],
          planSeconds: 300,
          remainingSeconds: 100,
          actualSeconds: 200,
        },
      ],
    });
    expect(model.totalSeconds).toBe(900);
    expect(model.segments).toEqual([
      expect.objectContaining({ id: "work", seconds: 600, ratio: 2 / 3 }),
      expect.objectContaining({ id: "health", seconds: 300, ratio: 1 / 3 }),
    ]);
    expect(
      model.segments.reduce((sum, item) => sum + item.ratio, 0),
    ).toBeCloseTo(1);
  });

  it("distinguishes Any and All without changing the supplied activity list", () => {
    const input = [
      {
        id: "both",
        tagIds: ["work", "health"],
        planSeconds: 600,
        remainingSeconds: 400,
        actualSeconds: 200,
      },
      {
        id: "work",
        tagIds: ["work"],
        planSeconds: 300,
        remainingSeconds: 200,
        actualSeconds: 100,
      },
    ];
    const any = buildTagRatioModel({
      activities: input,
      tags,
      selectedTagIds: ["work", "health"],
      metric: "remaining",
      matchMode: "any",
    });
    const all = buildTagRatioModel({
      activities: input,
      tags,
      selectedTagIds: ["work", "health"],
      metric: "remaining",
      matchMode: "all",
    });
    expect(any.matchedActivityCount).toBe(2);
    expect(any.totalSeconds).toBe(600);
    expect(all.matchedActivityCount).toBe(1);
    expect(all.totalSeconds).toBe(400);
    expect(input).toHaveLength(2);
  });

  it("normalizes invalid values, excludes pseudo activities, and preserves zero segments", () => {
    const model = buildTagRatioModel({
      tags,
      selectedTagIds: ["WORK", "health", "missing"],
      metric: "actual",
      matchMode: "any",
      activities: [
        {
          id: "bad",
          tagIds: ["work"],
          planSeconds: Number.NaN,
          remainingSeconds: -10,
          actualSeconds: Number.POSITIVE_INFINITY,
        },
        {
          id: "reward",
          tagIds: ["health"],
          planSeconds: 100,
          remainingSeconds: 100,
          actualSeconds: 100,
          excluded: true,
        },
      ],
    });
    expect(model.totalSeconds).toBe(0);
    expect(model.segments.map((item) => item.id)).toEqual(["work", "health"]);
    expect(model.segments.every((item) => item.ratio === 0)).toBe(true);
  });
});

describe("tag RPG levels", () => {
  it("starts at level zero and divides multi-tag history without duplicating time", () => {
    const levels = buildTagRpgLevels({
      records: [record({ durationMs: 120 * 60_000 })],
      definitions: [definition({ tagIds: ["work", "health"] })],
      tags,
      selectedTagIds: ["work", "health", "fun"],
      minutesPerLevel: 60,
      nowMs: 1,
    });
    expect(levels).toEqual([
      expect.objectContaining({
        id: "work",
        level: 1,
        attributedSeconds: 3600,
      }),
      expect.objectContaining({
        id: "health",
        level: 1,
        attributedSeconds: 3600,
      }),
      expect.objectContaining({ id: "fun", level: 0, attributedSeconds: 0 }),
    ]);
    expect(levels.reduce((sum, item) => sum + item.attributedSeconds, 0)).toBe(
      7200,
    );
  });

  it("reclassifies immutable history from the definition's current tags", () => {
    const work = buildTagRpgLevels({
      records: [record()],
      definitions: [definition({ tagIds: ["work"] })],
      tags,
      selectedTagIds: ["work", "health"],
      minutesPerLevel: 60,
      nowMs: 1,
    });
    const health = buildTagRpgLevels({
      records: [record()],
      definitions: [definition({ tagIds: ["health"], revision: 2 })],
      tags,
      selectedTagIds: ["work", "health"],
      minutesPerLevel: 60,
      nowMs: 1,
    });
    expect(work.map((item) => item.attributedSeconds)).toEqual([60, 0]);
    expect(health.map((item) => item.attributedSeconds)).toEqual([0, 60]);
  });

  it("includes running records from all timer modes and excludes deleted, break, and Reward Rest records", () => {
    const records = [
      record({ id: "session", source: "session", durationMs: 60_000 }),
      record({ id: "daily", source: "daily", durationMs: 60_000 }),
      record({ id: "single", source: "single", durationMs: 60_000 }),
      record({
        id: "running",
        source: "single",
        status: "running",
        startedAtMs: 10_000,
        endedAtMs: null,
        durationMs: 0,
      }),
      record({ id: "deleted", deletedAtMs: 1, durationMs: 99_000 }),
      record({ id: "break", endReason: "flow-break", durationMs: 99_000 }),
      record({
        id: "reward",
        activityId: "timeslice-banked-rest",
        durationMs: 99_000,
      }),
    ];
    const [level] = buildTagRpgLevels({
      records,
      definitions: [definition()],
      tags,
      selectedTagIds: ["work"],
      minutesPerLevel: 1,
      nowMs: 70_000,
    });
    expect(level.attributedSeconds).toBe(240);
    expect(level.level).toBe(4);
  });
});
