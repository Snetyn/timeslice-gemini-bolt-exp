import { beforeEach, describe, expect, it } from "vitest";
import { createActivityDefinition } from "./activityCatalogRepository";
import {
  completeTaskOccurrence,
  createInboxTask,
  ensureRecurringOccurrences,
  getAdaptiveEstimate,
  listTaskOccurrences,
  organizeTaskOccurrence,
  saveTaskPlannerSettings,
  scheduleTaskOccurrence,
} from "./taskPlanningRepository";
import { timeSliceDb } from "./timesliceDb";

describe("task planning repository", () => {
  beforeEach(async () => {
    timeSliceDb.close();
    await timeSliceDb.delete();
    await timeSliceDb.open();
  });

  it("captures one-off and reusable tasks without importing legacy rows", async () => {
    await timeSliceDb.dailyActivities.put({
      id: "legacy",
      value: [{ name: "Keep me" }],
      revision: 1,
      updatedAtMs: 1,
    });
    const oneOff = await createInboxTask({
      title: "Call vet",
      kind: "one-off",
    });
    const reusable = await createInboxTask({
      title: "Walk dog",
      kind: "reusable",
      baselineDurationSeconds: 1800,
    });
    expect(oneOff.activityDefinitionId).toBeNull();
    expect(reusable.activityDefinitionId).toBeTruthy();
    expect((await timeSliceDb.dailyActivities.get("legacy"))?.value).toEqual([
      { name: "Keep me" },
    ]);
  });

  it("leaves Inbox when dated or filed and remains the same occurrence", async () => {
    const task = await createInboxTask({
      title: "File taxes",
      kind: "one-off",
    });
    const filed = await organizeTaskOccurrence(task.id, {
      folderId: "finance",
    });
    expect(filed).toMatchObject({
      id: task.id,
      status: "planned",
      folderId: "finance",
      localDate: null,
    });
    const today = await scheduleTaskOccurrence(task.id, "2026-08-09");
    expect(today).toMatchObject({
      id: task.id,
      status: "planned",
      localDate: "2026-08-09",
    });
  });

  it("sums completed timer fragments before updating an adaptive estimate", async () => {
    const definition = (
      await createActivityDefinition({
        name: "Cleaning",
        planningEnabled: true,
        durationMode: "adaptive",
        baselineDurationSeconds: 3600,
        minimumDurationSeconds: 1200,
      })
    ).value;
    const task = await createInboxTask({ title: "Cleaning", kind: "one-off" });
    await timeSliceDb.taskOccurrences.update(task.id, {
      activityDefinitionId: definition.id,
      status: "planned",
    });
    await timeSliceDb.activitySessions.bulkAdd([
      fragment("a", task.id, 20 * 60_000),
      fragment("b", task.id, 40 * 60_000),
    ]);
    await completeTaskOccurrence(task.id, 10_000);
    expect(await getAdaptiveEstimate(definition.id)).toEqual({
      seconds: 3600,
      sampleCount: 1,
    });
  });

  it("generates recurrence idempotently and carry suppresses duplicates", async () => {
    await createActivityDefinition({
      name: "Medication",
      planningEnabled: true,
      recurrenceRule: { type: "daily" },
      rolloverPolicy: "carry",
    });
    await saveTaskPlannerSettings({
      version: 1,
      onboarded: true,
      normalWindowStartMinutes: 480,
      normalWindowEndMinutes: 1320,
      lastRecurrenceCheckDate: "2026-08-07",
    });
    await ensureRecurringOccurrences("2026-08-09");
    await ensureRecurringOccurrences("2026-08-09");
    const generated = (
      await listTaskOccurrences({ includeCompleted: true })
    ).filter((item) => item.title === "Medication");
    expect(generated).toHaveLength(1);
    expect(generated[0].skippedDueDates).toContain("2026-08-09");
  });
});

const fragment = (
  id: string,
  taskOccurrenceId: string,
  durationMs: number,
) => ({
  id,
  sourceTimerId: `daily:${id}`,
  activityId: id,
  activityName: "Cleaning",
  taskOccurrenceId,
  source: "daily" as const,
  kind: "standard" as const,
  status: "completed" as const,
  startedAtMs: 1,
  endedAtMs: 1 + durationMs,
  durationMs,
  endReason: "completed" as const,
  corrections: [],
  classificationCorrections: [],
  revision: 1,
  createdAtMs: 1,
  updatedAtMs: 1 + durationMs,
});
