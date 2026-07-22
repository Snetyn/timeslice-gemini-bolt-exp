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
  revision: number;
  updatedAtMs: number;
};

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
