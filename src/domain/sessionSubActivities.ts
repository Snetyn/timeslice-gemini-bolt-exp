export type SubActivityFundingOperation = {
  id: string;
  fundedSeconds: number;
  donatedSecondsById: Record<string, number>;
};

export type SubActivityFunding = {
  fundedSeconds: number;
  donatedSecondsById: Record<string, number>;
  operations: SubActivityFundingOperation[];
};

export type SessionHierarchyActivity = {
  id: string;
  name: string;
  color: string;
  duration: number;
  timeRemaining?: number;
  originalPlannedSeconds?: number;
  percentage?: number;
  countUp?: boolean;
  isCompleted?: boolean;
  isLocked?: boolean;
  priority?: boolean;
  isRewardRest?: boolean;
  tags?: string[];
  parentActivityId?: string;
  ownTimerCompleted?: boolean;
  subActivityFunding?: SubActivityFunding;
  [key: string]: unknown;
};

export type SubActivityFundingPreview = {
  maximumSeconds: number;
  requestedSeconds: number;
  fundedSeconds: number;
  donatedSecondsById: Record<string, number>;
  valid: boolean;
};

const seconds = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeMap = (value: unknown) => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([id, amount]) => [id, seconds(amount)] as const)
      .filter(([id, amount]) => Boolean(id) && amount > 0),
  );
};

export const normalizeSubActivityFunding = (
  value: unknown,
): SubActivityFunding | undefined => {
  if (!isRecord(value)) return undefined;
  const donatedSecondsById = normalizeMap(value.donatedSecondsById);
  const operations = Array.isArray(value.operations)
    ? value.operations
        .filter(isRecord)
        .map((operation) => ({
          id:
            typeof operation.id === "string" && operation.id
              ? operation.id
              : "legacy",
          fundedSeconds: seconds(operation.fundedSeconds),
          donatedSecondsById: normalizeMap(operation.donatedSecondsById),
        }))
        .filter((operation) => operation.fundedSeconds > 0)
    : [];
  const mappedTotal = Object.values(donatedSecondsById).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const fundedSeconds = seconds(value.fundedSeconds) || mappedTotal;
  if (fundedSeconds <= 0 && mappedTotal <= 0 && operations.length === 0) {
    return undefined;
  }
  return { fundedSeconds, donatedSecondsById, operations };
};

const isOrdinaryCountdown = (activity: SessionHierarchyActivity) =>
  !activity.countUp && !activity.isRewardRest;

/**
 * Repairs hierarchy without deleting records. Orphans, nested children and
 * incompatible parent/child records are promoted to top-level activities.
 */
export function normalizeSessionHierarchy<T extends SessionHierarchyActivity>(
  source: T[],
): T[] {
  const byId = new Map(source.map((activity) => [activity.id, activity]));
  const validParentId = new Map<string, string>();
  source.forEach((activity) => {
    const parentId = activity.parentActivityId;
    if (!parentId || parentId === activity.id) return;
    const parent = byId.get(parentId);
    if (
      parent &&
      !parent.parentActivityId &&
      isOrdinaryCountdown(parent) &&
      isOrdinaryCountdown(activity)
    ) {
      validParentId.set(activity.id, parentId);
    }
  });

  const normalized = source.map((activity) => {
    const parentActivityId = validParentId.get(activity.id);
    if (parentActivityId) {
      return {
        ...activity,
        parentActivityId,
        subActivityFunding: normalizeSubActivityFunding(
          activity.subActivityFunding,
        ),
      } as T;
    }
    const next = { ...activity } as T;
    delete next.parentActivityId;
    delete next.subActivityFunding;
    if (
      !source.some((candidate) => validParentId.get(candidate.id) === next.id)
    ) {
      delete next.ownTimerCompleted;
    }
    return next;
  });

  const children = new Map<string, T[]>();
  normalized.forEach((activity) => {
    if (!activity.parentActivityId) return;
    const list = children.get(activity.parentActivityId) || [];
    list.push(activity);
    children.set(activity.parentActivityId, list);
  });
  const ordered: T[] = [];
  normalized.forEach((activity) => {
    if (activity.parentActivityId) return;
    ordered.push(activity, ...(children.get(activity.id) || []));
  });
  return ordered;
}

export const sessionFamilyIds = (
  activities: SessionHierarchyActivity[],
  parentId: string,
) =>
  new Set([
    parentId,
    ...activities
      .filter((activity) => activity.parentActivityId === parentId)
      .map((activity) => activity.id),
  ]);

const activityRemaining = (activity: SessionHierarchyActivity) =>
  seconds(
    Number.isFinite(activity.timeRemaining)
      ? activity.timeRemaining
      : Number(activity.duration || 0) * 60,
  );

const parentIsProtected = (
  activity: SessionHierarchyActivity,
  byId: Map<string, SessionHierarchyActivity>,
) =>
  Boolean(
    activity.priority ||
    (activity.parentActivityId &&
      byId.get(activity.parentActivityId)?.priority),
  );

function proportionalShares(
  donors: Array<{ id: string; available: number; index: number }>,
  requested: number,
) {
  const total = donors.reduce((sum, donor) => sum + donor.available, 0);
  const funded = Math.min(seconds(requested), total);
  if (funded <= 0 || total <= 0) return {};
  const shares = donors.map((donor) => {
    const exact = (funded * donor.available) / total;
    return {
      ...donor,
      amount: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let remaining = funded - shares.reduce((sum, share) => sum + share.amount, 0);
  [...shares]
    .sort(
      (left, right) =>
        right.remainder - left.remainder || left.index - right.index,
    )
    .forEach((share) => {
      if (remaining <= 0 || share.amount >= share.available) return;
      share.amount += 1;
      remaining -= 1;
    });
  return Object.fromEntries(
    shares
      .filter((share) => share.amount > 0)
      .map((share) => [share.id, share.amount]),
  );
}

export function previewSubActivityFunding(options: {
  activities: SessionHierarchyActivity[];
  parentId: string;
  requestedSeconds: number;
  minimumDonorSeconds?: number;
}): SubActivityFundingPreview {
  const activities = normalizeSessionHierarchy(options.activities);
  const family = sessionFamilyIds(activities, options.parentId);
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const minimum = seconds(options.minimumDonorSeconds);
  const donors = activities
    .map((activity, index) => ({
      activity,
      index,
      available: Math.max(0, activityRemaining(activity) - minimum),
    }))
    .filter(
      ({ activity, available }) =>
        !family.has(activity.id) &&
        isOrdinaryCountdown(activity) &&
        !activity.isCompleted &&
        !parentIsProtected(activity, byId) &&
        available > 0,
    )
    .map(({ activity, index, available }) => ({
      id: activity.id,
      index,
      available,
    }));
  const maximumSeconds = donors.reduce(
    (sum, donor) => sum + donor.available,
    0,
  );
  const requestedSeconds = seconds(options.requestedSeconds);
  const fundedSeconds = Math.min(requestedSeconds, maximumSeconds);
  return {
    maximumSeconds,
    requestedSeconds,
    fundedSeconds,
    donatedSecondsById: proportionalShares(donors, fundedSeconds),
    valid: requestedSeconds > 0 && requestedSeconds <= maximumSeconds,
  };
}

const colorHash = (value: string) =>
  [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) | 0,
    0,
  );

export function subActivityColor(parentColor: string, childId: string) {
  const hsl = parentColor.match(
    /hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%\s*\)/i,
  );
  if (hsl) {
    const lightness = Math.max(
      20,
      Math.min(82, Number(hsl[3]) + 10 + (Math.abs(colorHash(childId)) % 9)),
    );
    return `hsl(${Number(hsl[1])}, ${Number(hsl[2])}%, ${lightness}%)`;
  }
  const hex = parentColor.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const expanded =
      hex[1].length === 3
        ? [...hex[1]].map((part) => part + part).join("")
        : hex[1];
    const mix = 0.16 + (Math.abs(colorHash(childId)) % 9) / 100;
    const channels = [0, 2, 4].map((offset) => {
      const channel = Number.parseInt(expanded.slice(offset, offset + 2), 16);
      return Math.round(channel + (255 - channel) * mix)
        .toString(16)
        .padStart(2, "0");
    });
    return `#${channels.join("")}`;
  }
  return parentColor || "#64748b";
}

const recalculatePercentages = <T extends SessionHierarchyActivity>(
  activities: T[],
) => {
  const total = activities.reduce(
    (sum, activity) =>
      sum + (activity.countUp ? 0 : Math.max(0, activityRemaining(activity))),
    0,
  );
  return activities.map((activity) => ({
    ...activity,
    percentage:
      activity.countUp || total <= 0
        ? 0
        : (activityRemaining(activity) / total) * 100,
  })) as T[];
};

export function addSessionSubActivity<
  T extends SessionHierarchyActivity,
>(options: {
  activities: T[];
  parentId: string;
  child: Pick<T, "id" | "name"> & Partial<T>;
  requestedSeconds: number;
  minimumDonorSeconds?: number;
  operationId?: string;
}): { activities: T[]; preview: SubActivityFundingPreview } {
  const activities = normalizeSessionHierarchy(options.activities);
  const parent = activities.find(
    (activity) => activity.id === options.parentId,
  );
  const name = String(options.child.name || "").trim();
  const duplicate = activities.some(
    (activity) =>
      activity.parentActivityId === options.parentId &&
      activity.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  const preview = previewSubActivityFunding({
    activities,
    parentId: options.parentId,
    requestedSeconds: options.requestedSeconds,
    minimumDonorSeconds: options.minimumDonorSeconds,
  });
  if (
    !parent ||
    parent.parentActivityId ||
    !isOrdinaryCountdown(parent) ||
    !name ||
    duplicate ||
    activities.some((activity) => activity.id === options.child.id) ||
    !preview.valid
  ) {
    throw new Error("Invalid sub-activity request");
  }
  const fundedSeconds = preview.fundedSeconds;
  const operation: SubActivityFundingOperation = {
    id: options.operationId || `sub-${options.child.id}`,
    fundedSeconds,
    donatedSecondsById: preview.donatedSecondsById,
  };
  const updated = activities.map((activity) => {
    const donated = preview.donatedSecondsById[activity.id] || 0;
    if (!donated) return activity;
    const nextRemaining = activityRemaining(activity) - donated;
    return {
      ...activity,
      timeRemaining: nextRemaining,
      duration: nextRemaining / 60,
      originalPlannedSeconds: Math.max(
        nextRemaining,
        seconds(activity.originalPlannedSeconds) - donated,
      ),
    } as T;
  });
  const child = {
    ...options.child,
    id: options.child.id,
    name,
    color:
      options.child.color || subActivityColor(parent.color, options.child.id),
    duration: fundedSeconds / 60,
    timeRemaining: fundedSeconds,
    originalPlannedSeconds: fundedSeconds,
    percentage: 0,
    countUp: false,
    isCompleted: false,
    parentActivityId: parent.id,
    tags: Array.isArray(parent.tags) ? [...parent.tags] : [],
    subActivityFunding: {
      fundedSeconds,
      donatedSecondsById: { ...preview.donatedSecondsById },
      operations: [operation],
    },
  } as T;
  const lastFamilyIndex = updated.reduce(
    (last, activity, index) =>
      activity.id === parent.id || activity.parentActivityId === parent.id
        ? index
        : last,
    updated.findIndex((activity) => activity.id === parent.id),
  );
  updated.splice(lastFamilyIndex + 1, 0, child);
  return { activities: recalculatePercentages(updated), preview };
}

export function increaseSessionSubActivity<
  T extends SessionHierarchyActivity,
>(options: {
  activities: T[];
  childId: string;
  requestedSeconds: number;
  minimumDonorSeconds?: number;
  operationId?: string;
}): { activities: T[]; preview: SubActivityFundingPreview } {
  const activities = normalizeSessionHierarchy(options.activities);
  const child = activities.find((activity) => activity.id === options.childId);
  if (!child?.parentActivityId) throw new Error("Sub-activity not found");
  const preview = previewSubActivityFunding({
    activities,
    parentId: child.parentActivityId,
    requestedSeconds: options.requestedSeconds,
    minimumDonorSeconds: options.minimumDonorSeconds,
  });
  if (!preview.valid) throw new Error("Invalid sub-activity increase");
  const existing = normalizeSubActivityFunding(child.subActivityFunding) || {
    fundedSeconds: 0,
    donatedSecondsById: {},
    operations: [],
  };
  const operation: SubActivityFundingOperation = {
    id:
      options.operationId ||
      `increase-${child.id}-${existing.operations.length + 1}`,
    fundedSeconds: preview.fundedSeconds,
    donatedSecondsById: preview.donatedSecondsById,
  };
  const updated = activities.map((activity) => {
    const donated = preview.donatedSecondsById[activity.id] || 0;
    if (activity.id === child.id) {
      const nextRemaining = activityRemaining(activity) + preview.fundedSeconds;
      return {
        ...activity,
        duration: Number(activity.duration || 0) + preview.fundedSeconds / 60,
        timeRemaining: nextRemaining,
        originalPlannedSeconds:
          seconds(activity.originalPlannedSeconds) + preview.fundedSeconds,
        isCompleted: false,
        completedElapsedSeconds: undefined,
        subActivityFunding: {
          fundedSeconds: existing.fundedSeconds + preview.fundedSeconds,
          donatedSecondsById: Object.fromEntries(
            Array.from(
              new Set([
                ...Object.keys(existing.donatedSecondsById),
                ...Object.keys(preview.donatedSecondsById),
              ]),
            ).map((id) => [
              id,
              (existing.donatedSecondsById[id] || 0) +
                (preview.donatedSecondsById[id] || 0),
            ]),
          ),
          operations: [...existing.operations, operation],
        },
      } as T;
    }
    if (!donated) return activity;
    const nextRemaining = activityRemaining(activity) - donated;
    return {
      ...activity,
      timeRemaining: nextRemaining,
      duration: Math.max(0, Number(activity.duration || 0) - donated / 60),
      originalPlannedSeconds: Math.max(
        0,
        seconds(activity.originalPlannedSeconds) - donated,
      ),
    } as T;
  });
  return { activities: recalculatePercentages(updated), preview };
}

export function removeSessionSubActivity<
  T extends SessionHierarchyActivity,
>(options: {
  activities: T[];
  childId: string;
  vaultSeconds?: number;
}): {
  activities: T[];
  vaultSeconds: number;
  restoredSecondsById: Record<string, number>;
} {
  const activities = normalizeSessionHierarchy(options.activities);
  const child = activities.find((activity) => activity.id === options.childId);
  if (!child?.parentActivityId) {
    return {
      activities,
      vaultSeconds: seconds(options.vaultSeconds),
      restoredSecondsById: {},
    };
  }
  let remaining = activityRemaining(child);
  const restoredSecondsById: Record<string, number> = {};
  const funding = normalizeSubActivityFunding(child.subActivityFunding);
  const originalShares = funding?.donatedSecondsById || {};
  const family = sessionFamilyIds(activities, child.parentActivityId);
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const next = activities
    .filter((activity) => activity.id !== child.id)
    .map((activity) => ({ ...activity })) as T[];

  Object.entries(originalShares).forEach(([donorId, funded]) => {
    if (remaining <= 0) return;
    const donor = next.find((activity) => activity.id === donorId);
    if (!donor || donor.isCompleted || donor.countUp || donor.isRewardRest)
      return;
    const restore = Math.min(remaining, funded);
    donor.timeRemaining = activityRemaining(donor) + restore;
    donor.duration = Number(donor.duration || 0) + restore / 60;
    donor.originalPlannedSeconds =
      seconds(donor.originalPlannedSeconds) + restore;
    restoredSecondsById[donor.id] = restore;
    remaining -= restore;
  });

  const fallbackDonors = next.filter(
    (activity) =>
      !family.has(activity.id) &&
      isOrdinaryCountdown(activity) &&
      !activity.isCompleted &&
      !parentIsProtected(activity, byId),
  );
  if (remaining > 0 && fallbackDonors.length > 0) {
    const base = Math.floor(remaining / fallbackDonors.length);
    let remainder = remaining - base * fallbackDonors.length;
    fallbackDonors.forEach((donor) => {
      const restore = base + (remainder-- > 0 ? 1 : 0);
      donor.timeRemaining = activityRemaining(donor) + restore;
      donor.duration = Number(donor.duration || 0) + restore / 60;
      donor.originalPlannedSeconds =
        seconds(donor.originalPlannedSeconds) + restore;
      restoredSecondsById[donor.id] =
        (restoredSecondsById[donor.id] || 0) + restore;
      remaining -= restore;
    });
  }
  return {
    activities: recalculatePercentages(next),
    vaultSeconds: seconds(options.vaultSeconds) + Math.max(0, remaining),
    restoredSecondsById,
  };
}

export function reorderSessionHierarchy<T extends SessionHierarchyActivity>(
  source: T[],
  dragId: string,
  targetId: string,
) {
  const activities = normalizeSessionHierarchy(source);
  const drag = activities.find((activity) => activity.id === dragId);
  const target = activities.find((activity) => activity.id === targetId);
  if (!drag || !target || drag.id === target.id) return activities;
  if (drag.parentActivityId || target.parentActivityId) {
    if (
      !drag.parentActivityId ||
      drag.parentActivityId !== target.parentActivityId
    ) {
      return activities;
    }
    const siblings = activities.filter(
      (activity) => activity.parentActivityId === drag.parentActivityId,
    );
    const from = siblings.findIndex((activity) => activity.id === dragId);
    const to = siblings.findIndex((activity) => activity.id === targetId);
    const [moved] = siblings.splice(from, 1);
    siblings.splice(to, 0, moved);
    let siblingIndex = 0;
    return activities.map((activity) =>
      activity.parentActivityId === drag.parentActivityId
        ? siblings[siblingIndex++]
        : activity,
    );
  }
  const family = activities.filter(
    (activity) =>
      activity.id === drag.id || activity.parentActivityId === drag.id,
  );
  const without = activities.filter(
    (activity) =>
      activity.id !== drag.id && activity.parentActivityId !== drag.id,
  );
  const targetRootId = target.parentActivityId || target.id;
  const targetIndex = without.findIndex(
    (activity) => activity.id === targetRootId,
  );
  without.splice(targetIndex, 0, ...family);
  return without;
}
