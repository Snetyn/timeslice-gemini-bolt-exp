import { describe, expect, it } from "vitest";
import {
  applyFlowRewardExpiry,
  awardFocusedFlowTime,
  completeFlowBreak,
  depositFlowReward,
  flowRewardPeriodKey,
  fundFlowBreak,
  nextFlowRewardResetAt,
  normalizeFlowRewardFields,
  refundUnusedFlowBreak,
  type FlowRewardState,
} from "./flowRewards";

const baseState = (
  overrides: Partial<FlowRewardState> = {},
): FlowRewardState => ({
  availableRestTime: 0,
  relaxationVaultSeconds: 0,
  totalEarnedToday: 0,
  accumulatedFractionalTime: 0,
  relaxationVaultPeriodKey: "never",
  relaxationVaultExpiryPolicy: "never",
  ...overrides,
});

describe("Flow reward allocation", () => {
  it("fills the quick reserve and sends exact overflow to the vault", () => {
    const result = depositFlowReward(
      baseState({ availableRestTime: 590 }),
      30,
      { quickReserveCapSeconds: 600, vaultCapSeconds: 0 },
    );
    expect(result.quickAddedSeconds).toBe(10);
    expect(result.vaultAddedSeconds).toBe(20);
    expect(result.discardedSeconds).toBe(0);
    expect(result.state.availableRestTime).toBe(600);
    expect(result.state.relaxationVaultSeconds).toBe(20);
    expect(result.state.totalEarnedToday).toBe(30);
  });

  it("reports reward rejected by an optional full vault", () => {
    const result = depositFlowReward(
      baseState({
        availableRestTime: 600,
        relaxationVaultSeconds: 295,
      }),
      20,
      { quickReserveCapSeconds: 600, vaultCapSeconds: 300 },
    );
    expect(result.vaultAddedSeconds).toBe(5);
    expect(result.discardedSeconds).toBe(15);
    expect(result.state.totalEarnedToday).toBe(5);
  });

  it("preserves fractional work across awards", () => {
    const first = awardFocusedFlowTime(baseState(), 4, 5, {
      quickReserveCapSeconds: 600,
      vaultCapSeconds: 0,
    });
    const second = awardFocusedFlowTime(first.state, 7, 5, {
      quickReserveCapSeconds: 600,
      vaultCapSeconds: 0,
    });
    expect(first.state.availableRestTime).toBe(0);
    expect(first.state.accumulatedFractionalTime).toBe(4);
    expect(second.state.availableRestTime).toBe(2);
    expect(second.state.accumulatedFractionalTime).toBe(1);
  });

  it("does not earn reward during either funded break type", () => {
    const funded = fundFlowBreak(
      baseState({ availableRestTime: 60 }),
      60,
      "reserve",
      "drain",
    );
    const result = awardFocusedFlowTime(
      { ...funded.state, isOnBreak: true },
      300,
      5,
      { quickReserveCapSeconds: 600, vaultCapSeconds: 0 },
    );
    expect(result.quickAddedSeconds).toBe(0);
    expect(result.vaultAddedSeconds).toBe(0);
    expect(result.state.accumulatedFractionalTime).toBe(0);
  });
});

describe("Flow reward breaks", () => {
  it("funds combined breaks from reserve first and refunds original sources", () => {
    const funded = fundFlowBreak(
      baseState({ availableRestTime: 300, relaxationVaultSeconds: 900 }),
      600,
      "combined",
      "postpone",
    );
    expect(funded.funding).toEqual({
      reserveSeconds: 300,
      vaultSeconds: 300,
      vaultPeriodKey: "never",
      vaultExpiryPolicy: "never",
    });
    const refunded = refundUnusedFlowBreak(funded.state, 450, "never");
    expect(refunded.availableRestTime).toBe(150);
    expect(refunded.relaxationVaultSeconds).toBe(900);
    expect(refunded.activeBreakFunding).toBeUndefined();
  });

  it("does not restore expired unused vault funding", () => {
    const funded = fundFlowBreak(
      baseState({
        relaxationVaultSeconds: 600,
        relaxationVaultPeriodKey: "day:2026-07-29",
      }),
      600,
      "vault",
      "postpone",
    );
    const expired = {
      ...funded.state,
      relaxationVaultPeriodKey: "day:2026-07-30",
    };
    const refunded = refundUnusedFlowBreak(expired, 500, "day:2026-07-30");
    expect(refunded.relaxationVaultSeconds).toBe(0);
  });

  it("clears funding on natural completion", () => {
    const funded = fundFlowBreak(
      baseState({ availableRestTime: 60 }),
      60,
      "reserve",
      "drain",
    );
    expect(completeFlowBreak(funded.state).activeBreakFunding).toBeUndefined();
  });
});

describe("Flow reward expiry", () => {
  it("uses the configured local reset boundary", () => {
    const beforeReset = new Date(2026, 6, 30, 5, 59);
    const afterReset = new Date(2026, 6, 30, 6, 0);
    expect(flowRewardPeriodKey(beforeReset, "daily", "06:00")).toBe(
      "day:2026-07-29",
    );
    expect(flowRewardPeriodKey(afterReset, "daily", "06:00")).toBe(
      "day:2026-07-30",
    );
    expect(nextFlowRewardResetAt(afterReset, "daily", "06:00")).toEqual(
      new Date(2026, 6, 31, 6, 0),
    );
  });

  it("normalizes old saved state without clearing a new vault field", () => {
    const now = new Date(2026, 6, 30, 12);
    const normalized = normalizeFlowRewardFields(
      { availableRestTime: 30, totalEarnedToday: 40 },
      now,
      "weekly",
      "06:00",
    );
    expect(normalized.relaxationVaultSeconds).toBe(0);
    expect(normalized.relaxationVaultPeriodKey).toBe("week:2026-07-27");
  });

  it("clears the stored vault once when the scheduled period changes", () => {
    const expired = applyFlowRewardExpiry(
      baseState({
        relaxationVaultSeconds: 600,
        relaxationVaultPeriodKey: "month:2026-06-01",
        relaxationVaultExpiryPolicy: "monthly",
      }),
      new Date(2026, 6, 30, 12),
      "monthly",
      "06:00",
    );
    expect(expired.relaxationVaultSeconds).toBe(0);
    expect(expired.relaxationVaultPeriodKey).toBe("month:2026-07-01");
    expect(
      applyFlowRewardExpiry(
        expired,
        new Date(2026, 6, 31, 12),
        "monthly",
        "06:00",
      ),
    ).toEqual(expired);
  });

  it("keeps the balance when the user changes the expiry policy", () => {
    const changed = applyFlowRewardExpiry(
      baseState({
        relaxationVaultSeconds: 600,
        relaxationVaultPeriodKey: "never",
        relaxationVaultExpiryPolicy: "never",
      }),
      new Date(2026, 6, 30, 12),
      "weekly",
      "06:00",
    );
    expect(changed.relaxationVaultSeconds).toBe(600);
    expect(changed.relaxationVaultPeriodKey).toBe("week:2026-07-27");
    expect(changed.relaxationVaultExpiryPolicy).toBe("weekly");
  });
});
