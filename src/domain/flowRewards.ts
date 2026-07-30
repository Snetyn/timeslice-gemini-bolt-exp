export type FlowRewardExpiry = "never" | "daily" | "weekly" | "monthly";
export type FlowBreakSource = "reserve" | "vault" | "combined";
export type FlowBreakBehavior = "drain" | "postpone";

export type FlowBreakFunding = {
  reserveSeconds: number;
  vaultSeconds: number;
  vaultPeriodKey: string;
  vaultExpiryPolicy?: FlowRewardExpiry;
};

export type FlowRewardState = {
  availableRestTime: number;
  relaxationVaultSeconds: number;
  totalEarnedToday: number;
  accumulatedFractionalTime: number;
  relaxationVaultPeriodKey: string;
  relaxationVaultExpiryPolicy?: FlowRewardExpiry;
  activeBreakFunding?: FlowBreakFunding;
  activeBreakBehavior?: FlowBreakBehavior;
  isOnBreak?: boolean;
  postponedDailyActivityIds?: string[];
  postponedSingleActivity?: boolean;
  [key: string]: unknown;
};

export type FlowRewardLimits = {
  quickReserveCapSeconds: number;
  vaultCapSeconds: number;
};

export type RewardDepositResult<T extends FlowRewardState> = {
  state: T;
  quickAddedSeconds: number;
  vaultAddedSeconds: number;
  discardedSeconds: number;
};

const nonNegativeInteger = (value: unknown): number => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};

const positiveInteger = (value: unknown, fallback: number): number => {
  const number = nonNegativeInteger(value);
  return number > 0 ? number : fallback;
};

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const parseResetTime = (resetTime: string): [number, number] => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(resetTime);
  if (!match) return [6, 0];
  return [
    Math.min(23, Math.max(0, Number(match[1]))),
    Math.min(59, Math.max(0, Number(match[2]))),
  ];
};

const rewardPeriodDate = (now: Date, resetTime: string): Date => {
  const [hour, minute] = parseResetTime(resetTime);
  const result = new Date(now);
  result.setSeconds(0, 0);
  if (
    result.getHours() < hour ||
    (result.getHours() === hour && result.getMinutes() < minute)
  ) {
    result.setDate(result.getDate() - 1);
  }
  result.setHours(12, 0, 0, 0);
  return result;
};

export const flowRewardPeriodKey = (
  now: Date,
  expiry: FlowRewardExpiry,
  resetTime = "06:00",
): string => {
  if (expiry === "never") return "never";
  const periodDate = rewardPeriodDate(now, resetTime);
  if (expiry === "daily") return `day:${localDateKey(periodDate)}`;
  if (expiry === "weekly") {
    const day = periodDate.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    periodDate.setDate(periodDate.getDate() + mondayOffset);
    return `week:${localDateKey(periodDate)}`;
  }
  periodDate.setDate(1);
  return `month:${localDateKey(periodDate)}`;
};

export const nextFlowRewardResetAt = (
  now: Date,
  expiry: FlowRewardExpiry,
  resetTime = "06:00",
): Date | null => {
  if (expiry === "never") return null;
  const [hour, minute] = parseResetTime(resetTime);
  const periodDate = rewardPeriodDate(now, resetTime);
  const next = new Date(periodDate);
  if (expiry === "daily") next.setDate(next.getDate() + 1);
  if (expiry === "weekly") {
    const day = next.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    next.setDate(next.getDate() + mondayOffset + 7);
  }
  if (expiry === "monthly") {
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
  }
  next.setHours(hour, minute, 0, 0);
  return next;
};

export const normalizeFlowRewardFields = <T extends Record<string, unknown>>(
  state: T,
  now: Date,
  expiry: FlowRewardExpiry,
  resetTime = "06:00",
): T & FlowRewardState => {
  const periodKey = flowRewardPeriodKey(now, expiry, resetTime);
  const fundingValue = state.activeBreakFunding;
  const activeBreakFunding =
    fundingValue &&
    typeof fundingValue === "object" &&
    !Array.isArray(fundingValue)
      ? {
          reserveSeconds: nonNegativeInteger(
            (fundingValue as Record<string, unknown>).reserveSeconds,
          ),
          vaultSeconds: nonNegativeInteger(
            (fundingValue as Record<string, unknown>).vaultSeconds,
          ),
          vaultPeriodKey:
            typeof (fundingValue as Record<string, unknown>).vaultPeriodKey ===
            "string"
              ? String((fundingValue as Record<string, unknown>).vaultPeriodKey)
              : periodKey,
          vaultExpiryPolicy:
            (fundingValue as Record<string, unknown>).vaultExpiryPolicy ===
              "daily" ||
            (fundingValue as Record<string, unknown>).vaultExpiryPolicy ===
              "weekly" ||
            (fundingValue as Record<string, unknown>).vaultExpiryPolicy ===
              "monthly" ||
            (fundingValue as Record<string, unknown>).vaultExpiryPolicy ===
              "never"
              ? ((fundingValue as Record<string, unknown>)
                  .vaultExpiryPolicy as FlowRewardExpiry)
              : undefined,
        }
      : undefined;
  const activeBreakBehavior =
    state.activeBreakBehavior === "drain" ||
    state.activeBreakBehavior === "postpone"
      ? state.activeBreakBehavior
      : undefined;

  return {
    ...state,
    availableRestTime: nonNegativeInteger(state.availableRestTime),
    relaxationVaultSeconds: nonNegativeInteger(state.relaxationVaultSeconds),
    totalEarnedToday: nonNegativeInteger(state.totalEarnedToday),
    accumulatedFractionalTime: Math.max(
      0,
      Number.isFinite(Number(state.accumulatedFractionalTime))
        ? Number(state.accumulatedFractionalTime)
        : 0,
    ),
    relaxationVaultPeriodKey:
      typeof state.relaxationVaultPeriodKey === "string"
        ? state.relaxationVaultPeriodKey
        : periodKey,
    relaxationVaultExpiryPolicy:
      state.relaxationVaultExpiryPolicy === "daily" ||
      state.relaxationVaultExpiryPolicy === "weekly" ||
      state.relaxationVaultExpiryPolicy === "monthly" ||
      state.relaxationVaultExpiryPolicy === "never"
        ? state.relaxationVaultExpiryPolicy
        : expiry,
    ...(activeBreakFunding ? { activeBreakFunding } : {}),
    ...(activeBreakBehavior ? { activeBreakBehavior } : {}),
    postponedDailyActivityIds: Array.isArray(state.postponedDailyActivityIds)
      ? state.postponedDailyActivityIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
    postponedSingleActivity: Boolean(state.postponedSingleActivity),
  };
};

export const applyFlowRewardExpiry = <T extends FlowRewardState>(
  state: T,
  now: Date,
  expiry: FlowRewardExpiry,
  resetTime = "06:00",
): T => {
  const currentPeriodKey = flowRewardPeriodKey(now, expiry, resetTime);
  if (
    state.relaxationVaultExpiryPolicy &&
    state.relaxationVaultExpiryPolicy !== expiry
  ) {
    return {
      ...state,
      relaxationVaultPeriodKey: currentPeriodKey,
      relaxationVaultExpiryPolicy: expiry,
    };
  }
  if (
    state.relaxationVaultPeriodKey === currentPeriodKey ||
    !state.relaxationVaultPeriodKey
  ) {
    return {
      ...state,
      relaxationVaultPeriodKey: currentPeriodKey,
      relaxationVaultExpiryPolicy: expiry,
    };
  }
  return {
    ...state,
    relaxationVaultSeconds: 0,
    relaxationVaultPeriodKey: currentPeriodKey,
    relaxationVaultExpiryPolicy: expiry,
  };
};

export const depositFlowReward = <T extends FlowRewardState>(
  state: T,
  rewardSeconds: number,
  limits: FlowRewardLimits,
): RewardDepositResult<T> => {
  const requested = nonNegativeInteger(rewardSeconds);
  const quickCap = nonNegativeInteger(limits.quickReserveCapSeconds);
  const vaultCap = nonNegativeInteger(limits.vaultCapSeconds);
  const quickRoom =
    quickCap > 0
      ? Math.max(0, quickCap - nonNegativeInteger(state.availableRestTime))
      : Number.POSITIVE_INFINITY;
  const quickAddedSeconds = Math.min(requested, quickRoom);
  const overflow = requested - quickAddedSeconds;
  const vaultRoom =
    vaultCap > 0
      ? Math.max(0, vaultCap - nonNegativeInteger(state.relaxationVaultSeconds))
      : Number.POSITIVE_INFINITY;
  const vaultAddedSeconds = Math.min(overflow, vaultRoom);
  const discardedSeconds = overflow - vaultAddedSeconds;
  const credited = quickAddedSeconds + vaultAddedSeconds;

  return {
    state: {
      ...state,
      availableRestTime:
        nonNegativeInteger(state.availableRestTime) + quickAddedSeconds,
      relaxationVaultSeconds:
        nonNegativeInteger(state.relaxationVaultSeconds) + vaultAddedSeconds,
      totalEarnedToday: nonNegativeInteger(state.totalEarnedToday) + credited,
    },
    quickAddedSeconds,
    vaultAddedSeconds,
    discardedSeconds,
  };
};

export const awardFocusedFlowTime = <T extends FlowRewardState>(
  state: T,
  focusedSeconds: number,
  ratio: number,
  limits: FlowRewardLimits,
): RewardDepositResult<T> => {
  if (state.isOnBreak) {
    return {
      state,
      quickAddedSeconds: 0,
      vaultAddedSeconds: 0,
      discardedSeconds: 0,
    };
  }
  const safeRatio = positiveInteger(ratio, 1);
  const accumulated =
    Math.max(0, Number(state.accumulatedFractionalTime) || 0) +
    Math.max(0, Number(focusedSeconds) || 0);
  const rewardSeconds = Math.floor(accumulated / safeRatio);
  const remainingFraction = accumulated % safeRatio;
  const deposited = depositFlowReward(state, rewardSeconds, limits);
  return {
    ...deposited,
    state: {
      ...deposited.state,
      accumulatedFractionalTime: remainingFraction,
    },
  };
};

export const fundFlowBreak = <T extends FlowRewardState>(
  state: T,
  requestedSeconds: number,
  source: FlowBreakSource,
  behavior: FlowBreakBehavior,
): { state: T; durationSeconds: number; funding: FlowBreakFunding } => {
  let remaining = nonNegativeInteger(requestedSeconds);
  let reserveSeconds = 0;
  let vaultSeconds = 0;
  if (source === "reserve" || source === "combined") {
    reserveSeconds = Math.min(
      remaining,
      nonNegativeInteger(state.availableRestTime),
    );
    remaining -= reserveSeconds;
  }
  if (source === "vault" || source === "combined") {
    vaultSeconds = Math.min(
      remaining,
      nonNegativeInteger(state.relaxationVaultSeconds),
    );
  }
  const funding = {
    reserveSeconds,
    vaultSeconds,
    vaultPeriodKey: state.relaxationVaultPeriodKey,
    vaultExpiryPolicy: state.relaxationVaultExpiryPolicy,
  };
  return {
    state: {
      ...state,
      availableRestTime:
        nonNegativeInteger(state.availableRestTime) - reserveSeconds,
      relaxationVaultSeconds:
        nonNegativeInteger(state.relaxationVaultSeconds) - vaultSeconds,
      activeBreakFunding: funding,
      activeBreakBehavior: behavior,
    },
    durationSeconds: reserveSeconds + vaultSeconds,
    funding,
  };
};

export const refundUnusedFlowBreak = <T extends FlowRewardState>(
  state: T,
  remainingSeconds: number,
  currentVaultPeriodKey: string,
): T => {
  const funding = state.activeBreakFunding;
  if (!funding) {
    return {
      ...state,
      availableRestTime:
        nonNegativeInteger(state.availableRestTime) +
        nonNegativeInteger(remainingSeconds),
      activeBreakFunding: undefined,
      activeBreakBehavior: undefined,
    };
  }
  const totalFunded = funding.reserveSeconds + funding.vaultSeconds;
  const consumed = Math.max(
    0,
    totalFunded - Math.min(totalFunded, nonNegativeInteger(remainingSeconds)),
  );
  const reserveConsumed = Math.min(funding.reserveSeconds, consumed);
  const vaultConsumed = Math.max(0, consumed - reserveConsumed);
  const reserveRefund = funding.reserveSeconds - reserveConsumed;
  const expiryPolicyChanged =
    Boolean(funding.vaultExpiryPolicy) &&
    Boolean(state.relaxationVaultExpiryPolicy) &&
    funding.vaultExpiryPolicy !== state.relaxationVaultExpiryPolicy;
  const vaultRefund =
    expiryPolicyChanged || funding.vaultPeriodKey === currentVaultPeriodKey
      ? funding.vaultSeconds - vaultConsumed
      : 0;

  return {
    ...state,
    availableRestTime:
      nonNegativeInteger(state.availableRestTime) + reserveRefund,
    relaxationVaultSeconds:
      nonNegativeInteger(state.relaxationVaultSeconds) + vaultRefund,
    activeBreakFunding: undefined,
    activeBreakBehavior: undefined,
  };
};

export const completeFlowBreak = <T extends FlowRewardState>(state: T): T => ({
  ...state,
  activeBreakFunding: undefined,
  activeBreakBehavior: undefined,
  postponedDailyActivityIds: undefined,
  postponedSingleActivity: undefined,
});
