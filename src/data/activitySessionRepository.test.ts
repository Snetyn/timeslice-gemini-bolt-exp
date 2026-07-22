import { beforeEach, describe, expect, it } from "vitest";
import {
  applyActivitySessionTrace,
  correctActivitySessionClassification,
  correctActivitySession,
  endActivitySession,
  listActivitySessions,
  setActivitySessionDeleted,
  switchActivitySession,
} from "./activitySessionRepository";
import {
  createActivityDefinition,
  createLifeArea,
  updateActivityDefinition,
} from "./activityCatalogRepository";
import { reconcilePersistedTimer, transitionTimer } from "./timerRepository";
import { readWorkspaceRevision, timeSliceDb } from "./timesliceDb";

const focus = {
  activityId: "focus",
  activityName: "Focus",
  activityColor: "#2563eb",
  source: "session" as const,
  kind: "countdown" as const,
};

describe("activity session repository", () => {
  beforeEach(async () => {
    timeSliceDb.close();
    await timeSliceDb.delete();
    await timeSliceDb.open();
  });

  it("commits timer transitions and recording boundaries atomically", async () => {
    await transitionTimer("session", "start", {
      nowMs: 1_000,
      mutationId: "recorded-start",
      recording: { context: focus },
    });
    expect((await listActivitySessions())[0]).toMatchObject({
      activityId: "focus",
      status: "running",
      startedAtMs: 1_000,
    });

    await transitionTimer("session", "pause", {
      nowMs: 6_000,
      mutationId: "recorded-pause",
      recording: { endReason: "paused" },
    });
    const [record] = await listActivitySessions();
    expect(record).toMatchObject({
      status: "completed",
      endedAtMs: 6_000,
      durationMs: 5_000,
      endReason: "paused",
    });
  });

  it("replays a recorded mutation without duplicating history", async () => {
    const options = {
      nowMs: 1_000,
      mutationId: "one-recorded-start",
      recording: { context: focus },
    };
    await transitionTimer("session", "start", options);
    const revision = await readWorkspaceRevision();
    await transitionTimer("session", "start", options);

    expect(await listActivitySessions()).toHaveLength(1);
    expect(await readWorkspaceRevision()).toBe(revision);
  });

  it("resolves a stable source and snapshots canonical area metadata atomically", async () => {
    const area = (await createLifeArea({ name: "Work", color: "#7c3aed" })).value;
    const definition = (
      await createActivityDefinition({
        name: "Deep work",
        color: "#2563eb",
        lifeAreaId: area.id,
        sourceKeys: ["session:stable"],
      })
    ).value;
    await transitionTimer("session", "start", {
      nowMs: 1_000,
      mutationId: "canonical-start",
      recording: {
        context: { ...focus, activityId: "stable", sourceKey: "session:stable" },
      },
    });
    await transitionTimer("session", "complete", {
      nowMs: 2_000,
      recording: { endReason: "completed" },
    });
    const first = (await listActivitySessions())[0];
    expect(first).toMatchObject({
      activityDefinitionId: definition.id,
      activityName: "Deep work",
      lifeAreaId: area.id,
      lifeAreaName: "Work",
      lifeAreaColor: "#7c3aed",
      classificationSource: "recorded",
    });

    await updateActivityDefinition(
      definition.id,
      { name: "Renamed future work" },
      definition.revision,
    );
    expect((await timeSliceDb.activitySessions.get(first.id))?.activityName).toBe(
      "Deep work",
    );
  });

  it("creates one definition per exact source identity, never per visible name", async () => {
    await switchActivitySession(
      "daily:one",
      { ...focus, source: "daily", kind: "standard", sourceKey: "daily:one" },
      1_000,
    );
    await endActivitySession("daily:one", "completed", 2_000);
    await switchActivitySession(
      "daily:two",
      { ...focus, source: "daily", kind: "standard", sourceKey: "daily:two" },
      3_000,
    );
    expect(await timeSliceDb.activityDefinitions.count()).toBe(2);
    expect(
      (await timeSliceDb.activityDefinitions.toArray()).map((item) => item.sourceKeys),
    ).toEqual(expect.arrayContaining([["daily:one"], ["daily:two"]]));
  });

  it("audits an explicit historical classification correction", async () => {
    const firstArea = (await createLifeArea({ name: "One", color: "#111111" })).value;
    const secondArea = (await createLifeArea({ name: "Two", color: "#222222" })).value;
    const firstDefinition = (
      await createActivityDefinition({ name: "Focus", lifeAreaId: firstArea.id })
    ).value;
    const secondDefinition = (
      await createActivityDefinition({ name: "Focus", lifeAreaId: secondArea.id })
    ).value;
    await switchActivitySession(
      "single",
      { ...focus, source: "single", kind: "standard", activityDefinitionId: firstDefinition.id },
      1_000,
    );
    await endActivitySession("single", "completed", 2_000);
    const record = (await listActivitySessions())[0];
    const corrected = (
      await correctActivitySessionClassification(
        record.id,
        secondDefinition.id,
        record.revision,
      )
    ).value;
    expect(corrected.lifeAreaName).toBe("Two");
    expect(corrected.classificationCorrections[0]).toMatchObject({
      previousActivityDefinitionId: firstDefinition.id,
      nextActivityDefinitionId: secondDefinition.id,
      reason: "correction",
    });
  });

  it("closes a recorded countdown when lifecycle reconciliation completes it", async () => {
    await transitionTimer("daily:focus", "start", {
      nowMs: 1_000,
      targetDurationMs: 1_000,
      recording: {
        context: { ...focus, source: "daily", kind: "standard" },
      },
    });
    await reconcilePersistedTimer("daily:focus", 3_000);
    expect((await listActivitySessions())[0]).toMatchObject({
      sourceTimerId: "daily:focus",
      status: "completed",
      durationMs: 2_000,
      endReason: "automatic",
    });
  });

  it("materializes ordered background slices and leaves only the last running", async () => {
    await switchActivitySession("session", focus, 1_000, "trace-start");
    await applyActivitySessionTrace(
      {
        sourceTimerId: "session",
        observedAtMs: 7_000,
        elapsedSeconds: 6,
        slices: [
          {
            activityId: "focus",
            offsetSeconds: 0,
            durationSeconds: 2,
            kind: "countdown",
          },
          {
            activityId: "breakout",
            offsetSeconds: 2,
            durationSeconds: 3,
            kind: "count-up",
          },
          {
            activityId: "finish",
            offsetSeconds: 5,
            durationSeconds: 1,
            kind: "overtime",
          },
        ],
        activities: [
          focus,
          {
            activityId: "breakout",
            activityName: "Breakout",
            source: "session",
            kind: "count-up",
          },
          {
            activityId: "finish",
            activityName: "Finish",
            source: "session",
            kind: "overtime",
          },
        ],
        currentActivity: {
          activityId: "finish",
          activityName: "Finish",
          source: "session",
          kind: "overtime",
        },
        continues: true,
      },
      "ordered-trace",
    );

    const records = (await listActivitySessions()).sort(
      (left, right) => left.startedAtMs - right.startedAtMs,
    );
    expect(
      records.map((record) => [
        record.activityId,
        record.startedAtMs,
        record.endedAtMs,
      ]),
    ).toEqual([
      ["focus", 1_000, 3_000],
      ["breakout", 3_000, 6_000],
      ["finish", 6_000, null],
    ]);
  });

  it("excludes a leading Flowmodoro break from recorded duration", async () => {
    await switchActivitySession("session", focus, 1_000, "break-start");
    await applyActivitySessionTrace(
      {
        sourceTimerId: "session",
        observedAtMs: 8_000,
        elapsedSeconds: 6,
        slices: [
          {
            activityId: "focus",
            offsetSeconds: 3,
            durationSeconds: 3,
            kind: "countdown",
          },
        ],
        activities: [focus],
        currentActivity: focus,
        continues: true,
      },
      "break-trace",
    );

    const records = (await listActivitySessions()).sort(
      (left, right) => left.startedAtMs - right.startedAtMs,
    );
    expect(
      records.map((record) => [record.startedAtMs, record.endedAtMs]),
    ).toEqual([
      [1_000, 2_000],
      [5_000, null],
    ]);
  });

  it("audits corrections and uses reversible soft deletion", async () => {
    await transitionTimer("session", "start", {
      nowMs: 1_000,
      recording: { context: focus },
    });
    await transitionTimer("session", "complete", {
      nowMs: 61_000,
      recording: { endReason: "completed" },
    });
    let [record] = await listActivitySessions();
    record = (
      await correctActivitySession(
        record.id,
        { activityName: "Deep focus", startedAtMs: 2_000, durationMs: 30_000 },
        record.revision,
      )
    ).value;
    expect(record).toMatchObject({
      activityName: "Deep focus",
      startedAtMs: 2_000,
      endedAtMs: 32_000,
      durationMs: 30_000,
    });
    expect(record.corrections).toHaveLength(1);

    record = (await setActivitySessionDeleted(record.id, true, record.revision))
      .value;
    expect(await listActivitySessions()).toHaveLength(0);
    expect(await listActivitySessions({ includeDeleted: true })).toHaveLength(
      1,
    );

    await setActivitySessionDeleted(record.id, false, record.revision);
    expect(await listActivitySessions()).toHaveLength(1);
  });
});
