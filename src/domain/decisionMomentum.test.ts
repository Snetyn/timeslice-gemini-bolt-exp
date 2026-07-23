import { describe, expect, it } from "vitest";
import { manualOpportunityRewardable, orderedDecisionSuggestionIds } from "./decisionMomentum";

describe("Decision Momentum rules", () => {
  it("uses current-mode order before global order and skips distractions", () => {
    const item = (id: string, patch = {}) => ({ activityDefinitionId: id, decisionType: "normal" as const, archived: false, available: true, completed: false, ...patch });
    expect(orderedDecisionSuggestionIds([item("daily"), item("duplicate")], [item("duplicate"), item("global"), item("distraction", { decisionType: "distraction" })])).toEqual(["daily", "duplicate", "global"]);
  });

  it("unlocks a manual reward only after truthful work or a fresh long foreground transition", () => {
    expect(manualOpportunityRewardable({ hasPreviousReward: false, focusedMsSinceReward: 0, freshForegroundAfterMs: 0 })).toBe(true);
    expect(manualOpportunityRewardable({ hasPreviousReward: true, focusedMsSinceReward: 59_999, freshForegroundAfterMs: 0 })).toBe(false);
    expect(manualOpportunityRewardable({ hasPreviousReward: true, focusedMsSinceReward: 60_000, freshForegroundAfterMs: 0 })).toBe(true);
    expect(manualOpportunityRewardable({ hasPreviousReward: true, focusedMsSinceReward: 0, freshForegroundAfterMs: 900_000 })).toBe(true);
  });
});
