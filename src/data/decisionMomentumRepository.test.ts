import { beforeEach, describe, expect, it } from "vitest";
import { createActivityDefinition, createLifeArea } from "./activityCatalogRepository";
import { getOrCreateDecisionOpportunity } from "./decisionMomentumRepository";
import { timeSliceDb } from "./timesliceDb";
import { transitionTimer } from "./timerRepository";

describe("Decision Momentum repository", () => {
  beforeEach(async () => {
    timeSliceDb.close();
    await timeSliceDb.delete();
    await timeSliceDb.open();
  });

  it("commits activity start and one immediate reward atomically and idempotently", async () => {
    const area = (await createLifeArea({ name: "Work", color: "#6366f1" })).value;
    const definition = (await createActivityDefinition({ name: "Focus", lifeAreaId: area.id })).value;
    const opportunity = (await getOrCreateDecisionOpportunity("manual", "idle", 1_000)).value;
    const options = {
      nowMs: 2_000,
      mutationId: "decision-start",
      recording: { context: { activityId: "focus", activityName: "Focus", source: "single" as const, kind: "count-up" as const, activityDefinitionId: definition.id } },
      momentum: { opportunityId: opportunity.id, activityDefinitionId: definition.id, source: "single" as const, interaction: "suggested" as const },
    };
    await transitionTimer("single", "start", options);
    await transitionTimer("single", "start", options);
    expect(await timeSliceDb.activitySessions.count()).toBe(1);
    expect(await timeSliceDb.decisionMomentum.count()).toBe(1);
    expect(await timeSliceDb.decisionMomentum.toCollection().first()).toMatchObject({ lifeAreaId: area.id, confirmedAtMs: 2_000 });
    expect((await timeSliceDb.decisionOpportunities.get(opportunity.id))?.status).toBe("rewarded");
  });

  it("creates no reward when the activity start transaction fails", async () => {
    const definition = (await createActivityDefinition({ name: "Focus" })).value;
    const opportunity = (await getOrCreateDecisionOpportunity("manual", "idle", 1_000)).value;
    await expect(transitionTimer("single", "start", {
      nowMs: 2_000,
      recording: { context: { activityId: "", activityName: "", source: "single", kind: "count-up" } },
      momentum: { opportunityId: opportunity.id, activityDefinitionId: definition.id, source: "single", interaction: "suggested" },
    })).rejects.toThrow("Invalid activity recording context");
    expect(await timeSliceDb.decisionMomentum.count()).toBe(0);
    expect(await timeSliceDb.timers.count()).toBe(0);
  });

  it("does not unlock another rewardable manual opportunity after less than 60 seconds", async () => {
    const definition = (await createActivityDefinition({ name: "Focus" })).value;
    const first = (await getOrCreateDecisionOpportunity("manual", "idle", 1_000)).value;
    await transitionTimer("single", "start", { nowMs: 2_000, recording: { context: { activityId: "focus", activityName: "Focus", source: "single", kind: "count-up", activityDefinitionId: definition.id } }, momentum: { opportunityId: first.id, activityDefinitionId: definition.id, source: "single", interaction: "suggested" } });
    await transitionTimer("single", "complete", { nowMs: 31_000, recording: { endReason: "completed" } });
    const next = (await getOrCreateDecisionOpportunity("manual", "idle", 32_000)).value;
    expect(next.rewardable).toBe(false);
  });
});
