import type { ActivitySessionSource } from "./activitySession";

export type DecisionOpportunityReason = "manual" | "after-activity" | "foreground";
export type DecisionInteraction = "suggested" | "alternative" | "distraction-redirect";

export type DecisionOpportunityRecord = {
  id: string;
  reason: DecisionOpportunityReason;
  status: "open" | "rewarded" | "closed";
  createdAtMs: number;
  backgroundStartedAtMs?: number;
  lastRewardAtCreationMs?: number;
  rewardable: boolean;
  sourceKey: string;
  revision: number;
  updatedAtMs: number;
};

export type DecisionSuggestionCandidate = {
  activityDefinitionId: string;
  decisionType: "normal" | "leisure" | "distraction";
  archived: boolean;
  available: boolean;
  completed: boolean;
};

export function orderedDecisionSuggestionIds(
  currentMode: DecisionSuggestionCandidate[],
  global: DecisionSuggestionCandidate[],
) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of [...currentMode, ...global]) {
    if (
      seen.has(candidate.activityDefinitionId) ||
      candidate.archived ||
      !candidate.available ||
      candidate.completed ||
      candidate.decisionType === "distraction"
    ) continue;
    seen.add(candidate.activityDefinitionId);
    result.push(candidate.activityDefinitionId);
  }
  return result;
}

export const manualOpportunityRewardable = ({
  hasPreviousReward,
  focusedMsSinceReward,
  freshForegroundAfterMs,
}: {
  hasPreviousReward: boolean;
  focusedMsSinceReward: number;
  freshForegroundAfterMs: number;
}) =>
  !hasPreviousReward ||
  Math.max(0, focusedMsSinceReward) >= 60_000 ||
  Math.max(0, freshForegroundAfterMs) >= 15 * 60_000;

export type DecisionMomentumRecord = {
  id: string;
  decisionOpportunityId: string;
  activityDefinitionId: string;
  activityName: string;
  lifeAreaId: string | null;
  lifeAreaName?: string;
  lifeAreaColor?: string;
  source: ActivitySessionSource;
  interaction: DecisionInteraction;
  confirmedAtMs: number;
  revision: number;
  updatedAtMs: number;
};
