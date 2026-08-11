import type { QuickActionFundingMode, SessionFundingEntry } from "./freeFlow";

export type QuickActionFundingActivity = {
  id: string;
  timeRemaining: number;
  countUp?: boolean;
  isCompleted?: boolean;
  priority?: boolean;
  locked?: boolean;
  isRewardRest?: boolean;
};

export type QuickActionFundingInput<T extends QuickActionFundingActivity> = {
  activities: T[];
  currentActivityIndex: number;
  mode: QuickActionFundingMode;
  elapsedSeconds: number;
  vaultSeconds: number;
  offsetSeconds?: number;
  allowProtectedCurrent?: boolean;
  minimumBalanceSeconds?: number;
};

export type QuickActionFundingResult<T extends QuickActionFundingActivity> = {
  activities: T[];
  vaultSeconds: number;
  fundedSeconds: number;
  overtimeSeconds: number;
  trace: SessionFundingEntry[];
};

const seconds = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};

const transferable = (
  activity: QuickActionFundingActivity,
  minimumBalanceSeconds: number,
) => Math.max(0, seconds(activity.timeRemaining) - minimumBalanceSeconds);

const automaticEligible = (
  activity: QuickActionFundingActivity,
  minimumBalanceSeconds: number,
) =>
  !activity.countUp &&
  !activity.isCompleted &&
  !activity.isRewardRest &&
  !activity.priority &&
  transferable(activity, minimumBalanceSeconds) > 0;

/**
 * Charges exactly one elapsed batch to the selected Session source. It never
 * invents funding: the unfunded tail is returned as explicit overtime.
 */
export function fundQuickActionElapsed<T extends QuickActionFundingActivity>(
  input: QuickActionFundingInput<T>,
): QuickActionFundingResult<T> {
  const elapsed = seconds(input.elapsedSeconds);
  const minimum = seconds(input.minimumBalanceSeconds);
  const offset = seconds(input.offsetSeconds);
  const activities = input.activities.map((activity) => ({ ...activity }));
  let vaultSeconds = seconds(input.vaultSeconds);
  const trace: SessionFundingEntry[] = [];
  let remaining = elapsed;

  const drain = (index: number, requested: number) => {
    const activity = activities[index];
    if (!activity || requested <= 0) return 0;
    const amount = Math.min(requested, transferable(activity, minimum));
    if (amount <= 0) return 0;
    activity.timeRemaining = seconds(activity.timeRemaining) - amount;
    trace.push({
      activityId: activity.id,
      seconds: amount,
      offsetSeconds: offset,
    });
    return amount;
  };

  if (input.mode === "vault") {
    const amount = Math.min(remaining, vaultSeconds);
    vaultSeconds -= amount;
    remaining -= amount;
    if (amount > 0) {
      trace.push({
        activityId: "session-time-vault",
        seconds: amount,
        offsetSeconds: offset,
      });
    }
  } else if (input.mode === "current") {
    const current = activities[input.currentActivityIndex];
    const eligible =
      current &&
      !current.countUp &&
      !current.isCompleted &&
      !current.isRewardRest &&
      !current.locked &&
      (!current.priority || input.allowProtectedCurrent);
    if (eligible) remaining -= drain(input.currentActivityIndex, remaining);
  } else {
    const eligible = activities
      .map((activity, index) => ({ activity, index }))
      .filter(({ activity }) => automaticEligible(activity, minimum));
    if (input.mode === "next") {
      const ordered = [...eligible].sort((left, right) => {
        const length = Math.max(1, activities.length);
        const leftDistance =
          (left.index - input.currentActivityIndex + length) % length || length;
        const rightDistance =
          (right.index - input.currentActivityIndex + length) % length ||
          length;
        return leftDistance - rightDistance || left.index - right.index;
      });
      for (const donor of ordered) {
        if (remaining <= 0) break;
        remaining -= drain(donor.index, remaining);
      }
    } else {
      const available = eligible.reduce(
        (sum, donor) => sum + transferable(donor.activity, minimum),
        0,
      );
      const funded = Math.min(remaining, available);
      const shares = eligible.map((donor) => {
        const exact =
          available > 0
            ? (funded * transferable(donor.activity, minimum)) / available
            : 0;
        return {
          ...donor,
          amount: Math.floor(exact),
          remainder: exact - Math.floor(exact),
        };
      });
      let remainder =
        funded - shares.reduce((sum, share) => sum + share.amount, 0);
      [...shares]
        .sort(
          (left, right) =>
            right.remainder - left.remainder || left.index - right.index,
        )
        .forEach((share) => {
          if (remainder <= 0) return;
          share.amount += 1;
          remainder -= 1;
        });
      shares.forEach((share) => {
        if (share.amount <= 0) return;
        drain(share.index, share.amount);
      });
      remaining -= funded;
    }
  }

  return {
    activities,
    vaultSeconds,
    fundedSeconds: elapsed - remaining,
    overtimeSeconds: remaining,
    trace,
  };
}

export function mergeFundingTrace(
  previous: SessionFundingEntry[],
  next: SessionFundingEntry[],
) {
  const merged = previous.map((entry) => ({ ...entry }));
  next.forEach((entry) => {
    const tail = merged.at(-1);
    if (
      tail &&
      tail.activityId === entry.activityId &&
      tail.offsetSeconds + tail.seconds === entry.offsetSeconds
    ) {
      tail.seconds += entry.seconds;
    } else {
      merged.push({ ...entry });
    }
  });
  return merged;
}
