import { manualOpportunityRewardable, orderedDecisionSuggestionIds, type DecisionInteraction, type DecisionMomentumRecord, type DecisionOpportunityReason, type DecisionOpportunityRecord } from "../domain/decisionMomentum";
import { flattenFolderTree, type ActivityDefinitionRecord } from "../domain/activityCatalog";
import type { ActivitySessionSource } from "../domain/activitySession";
import { timeSliceDb, transactIdempotent } from "./timesliceDb";

export type MomentumCommand = {
  opportunityId: string;
  activityDefinitionId: string;
  source: ActivitySessionSource;
  interaction: DecisionInteraction;
  atMs: number;
};

const focusedSince = async (atMs: number) => {
  const records = await timeSliceDb.activitySessions.toArray();
  return records.reduce((total, record) => {
    if (record.deletedAtMs !== undefined) return total;
    const end = record.status === "running" ? Date.now() : record.endedAtMs || record.startedAtMs;
    return total + Math.max(0, end - Math.max(record.startedAtMs, atMs));
  }, 0);
};

export async function getOrCreateDecisionOpportunity(
  reason: DecisionOpportunityReason,
  sourceKey: string,
  nowMs = Date.now(),
  foregroundBackgroundMs = 0,
  mutationId = crypto.randomUUID(),
) {
  const fingerprint = JSON.stringify({ reason, sourceKey, nowMs, foregroundBackgroundMs });
  return transactIdempotent(
    ["decisionOpportunities", "decisionMomentum", "activitySessions"],
    { id: mutationId, fingerprint },
    async (revision) => {
      const lastReward = (await timeSliceDb.decisionMomentum.orderBy("confirmedAtMs").reverse().first()) || null;
      const rewardable = reason === "manual"
        ? manualOpportunityRewardable({ hasPreviousReward: Boolean(lastReward), focusedMsSinceReward: lastReward ? await focusedSince(lastReward.confirmedAtMs) : 0, freshForegroundAfterMs: foregroundBackgroundMs })
        : reason === "foreground"
          ? foregroundBackgroundMs >= 15 * 60_000
          : true;
      const id = reason === "manual"
        ? `manual:${lastReward?.id || "first"}:${rewardable ? "ready" : "cooldown"}`
        : `${reason}:${sourceKey}`;
      const existing = await timeSliceDb.decisionOpportunities.get(id);
      if (existing) return existing;
      const opportunity: DecisionOpportunityRecord = { id, reason, sourceKey, status: "open", rewardable, createdAtMs: nowMs, backgroundStartedAtMs: reason === "foreground" ? nowMs - foregroundBackgroundMs : undefined, lastRewardAtCreationMs: lastReward?.confirmedAtMs, revision, updatedAtMs: nowMs };
      await timeSliceDb.decisionOpportunities.put(opportunity);
      return opportunity;
    },
  );
}

export async function applyMomentumCommand(command: MomentumCommand, revision: number) {
  const opportunity = await timeSliceDb.decisionOpportunities.get(command.opportunityId);
  if (!opportunity || opportunity.status !== "open" || !opportunity.rewardable) return null;
  const existing = await timeSliceDb.decisionMomentum.where("decisionOpportunityId").equals(opportunity.id).first();
  if (existing) return existing;
  const definition = await timeSliceDb.activityDefinitions.get(command.activityDefinitionId);
  if (!definition || definition.archivedAtMs !== undefined || definition.decisionType === "distraction") return null;
  const area = definition.lifeAreaId ? await timeSliceDb.lifeAreas.get(definition.lifeAreaId) : undefined;
  const record: DecisionMomentumRecord = { id: `momentum:${opportunity.id}`, decisionOpportunityId: opportunity.id, activityDefinitionId: definition.id, activityName: definition.name, lifeAreaId: area?.id || null, lifeAreaName: area?.name, lifeAreaColor: area?.color, source: command.source, interaction: command.interaction, confirmedAtMs: command.atMs, revision, updatedAtMs: command.atMs };
  await timeSliceDb.decisionMomentum.put(record);
  await timeSliceDb.decisionOpportunities.put({ ...opportunity, status: "rewarded", revision, updatedAtMs: command.atMs });
  return record;
}

export async function listDecisionSuggestions(currentSourceKeys: string[] = []) {
  const [definitions, folders] = await Promise.all([timeSliceDb.activityDefinitions.orderBy("order").toArray(), timeSliceDb.activityFolders.toArray()]);
  const effectiveArchived = new Set(flattenFolderTree(folders, true).filter((folder) => folder.effectivelyArchived).map((folder) => folder.id));
  const bySource = new Map(definitions.flatMap((definition) => definition.sourceKeys.map((key) => [key, definition] as const)));
  const current = currentSourceKeys.map((key) => bySource.get(key)).filter((item): item is ActivityDefinitionRecord => Boolean(item));
  const candidate = (definition: ActivityDefinitionRecord) => ({ activityDefinitionId: definition.id, decisionType: definition.decisionType, archived: definition.archivedAtMs !== undefined || Boolean(definition.folderId && effectiveArchived.has(definition.folderId)), available: true, completed: false });
  const ids = orderedDecisionSuggestionIds(current.map(candidate), definitions.map(candidate));
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  return ids.map((id) => byId.get(id)).filter((item): item is ActivityDefinitionRecord => Boolean(item));
}

export const listDecisionMomentum = () => timeSliceDb.decisionMomentum.orderBy("confirmedAtMs").reverse().toArray();
