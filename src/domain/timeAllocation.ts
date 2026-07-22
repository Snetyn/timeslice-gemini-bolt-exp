export type AllocationActivity = {
  id: string;
  name: string;
  timeRemaining: number;
  priority?: boolean;
  isCompleted?: boolean;
  countUp?: boolean;
};

export type AllocationSource = "vault" | "otherActivities" | string;
export type AllocationOperation = "transfer" | "extra";

export type AllocationRequest = {
  operation: AllocationOperation;
  activities: AllocationActivity[];
  vaultSeconds: number;
  sessionRevision: number;
  requestedSeconds: number;
  sourceId: AllocationSource;
  targetId: string | "vault";
  minimumDonorSeconds?: number;
  allowProtectedManual?: boolean;
};

export type AllocationChange = {
  id: string;
  name: string;
  beforeSeconds: number;
  afterSeconds: number;
  protected: boolean;
};

export type AllocationPreview = {
  request: AllocationRequest;
  fingerprint: string;
  valid: boolean;
  error?: string;
  requestedSeconds: number;
  appliedSeconds: number;
  unfundedSeconds: number;
  activities: AllocationActivity[];
  vaultBeforeSeconds: number;
  vaultAfterSeconds: number;
  changes: AllocationChange[];
  protectedOverrideRequired: boolean;
};

const seconds = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function allocationFingerprint(input: Pick<AllocationRequest, "activities" | "vaultSeconds" | "sessionRevision">) {
  return JSON.stringify({
    order: input.activities.map((activity) => activity.id),
    remaining: input.activities.map((activity) => [activity.id, seconds(activity.timeRemaining)]),
    protected: input.activities.map((activity) => [activity.id, Boolean(activity.priority)]),
    vault: seconds(input.vaultSeconds),
    revision: Math.max(0, Math.floor(input.sessionRevision || 0)),
  });
}

export function calculateAllocation(request: AllocationRequest): AllocationPreview {
  const activities = request.activities.map((activity) => ({
    ...activity,
    timeRemaining: seconds(activity.timeRemaining),
  }));
  const requestedSeconds = seconds(request.requestedSeconds);
  const vaultBeforeSeconds = seconds(request.vaultSeconds);
  let vaultAfterSeconds = vaultBeforeSeconds;
  let remaining = requestedSeconds;
  let protectedOverrideRequired = false;
  let error: string | undefined;
  const target = request.targetId === "vault"
    ? null
    : activities.find((activity) => activity.id === request.targetId);
  const source = request.sourceId === "vault" || request.sourceId === "otherActivities"
    ? null
    : activities.find((activity) => activity.id === request.sourceId);
  const validTarget = request.targetId === "vault" || Boolean(target && !target.isCompleted && !target.countUp);
  if (!requestedSeconds) error = "Enter a positive amount.";
  else if (!validTarget) error = "Choose an active countdown target.";
  else if (request.operation === "transfer" && !source && request.sourceId !== "vault")
    error = "Choose an available source.";
  else if (source && (source.isCompleted || source.countUp))
    error = "That source cannot donate time.";
  else if (source?.priority && !request.allowProtectedManual) {
    error = "This activity is Priority & protected. Confirm the protected override explicitly.";
    protectedOverrideRequired = true;
  }

  const addToTarget = (amount: number) => {
    if (request.targetId === "vault") vaultAfterSeconds += amount;
    else if (target) target.timeRemaining += amount;
  };

  if (!error) {
    if (request.sourceId === "vault") {
      const amount = Math.min(remaining, vaultAfterSeconds);
      vaultAfterSeconds -= amount;
      addToTarget(amount);
      remaining -= amount;
    } else if (request.sourceId === "otherActivities") {
      const minimum = seconds(request.minimumDonorSeconds || 0);
      const donors = activities
        .filter((activity) =>
          activity.id !== request.targetId &&
          !activity.priority &&
          !activity.isCompleted &&
          !activity.countUp &&
          activity.timeRemaining > minimum,
        )
        .reverse();
      for (const donor of donors) {
        if (remaining <= 0) break;
        const amount = Math.min(remaining, donor.timeRemaining - minimum);
        donor.timeRemaining -= amount;
        addToTarget(amount);
        remaining -= amount;
      }
    } else if (source) {
      const minimum = request.operation === "extra" ? seconds(request.minimumDonorSeconds || 0) : 0;
      const amount = Math.min(remaining, Math.max(0, source.timeRemaining - minimum));
      source.timeRemaining -= amount;
      addToTarget(amount);
      remaining -= amount;
    }
  }

  const changes = activities
    .map((activity) => {
      const before = request.activities.find((candidate) => candidate.id === activity.id);
      return {
        id: activity.id,
        name: activity.name,
        beforeSeconds: seconds(before?.timeRemaining || 0),
        afterSeconds: activity.timeRemaining,
        protected: Boolean(activity.priority),
      };
    })
    .filter((change) => change.beforeSeconds !== change.afterSeconds);
  const appliedSeconds = error ? 0 : requestedSeconds - remaining;
  return {
    request,
    fingerprint: allocationFingerprint(request),
    valid: !error && appliedSeconds > 0,
    error,
    requestedSeconds,
    appliedSeconds,
    unfundedSeconds: error ? requestedSeconds : remaining,
    activities,
    vaultBeforeSeconds,
    vaultAfterSeconds,
    changes,
    protectedOverrideRequired,
  };
}

export function confirmAllocation(preview: AllocationPreview, current: Omit<AllocationRequest, "requestedSeconds" | "sourceId" | "targetId" | "operation">) {
  if (allocationFingerprint(current) !== preview.fingerprint) {
    return { committed: false as const, reason: "stale" as const, preview: calculateAllocation({ ...preview.request, ...current }) };
  }
  const refreshed = calculateAllocation({ ...preview.request, ...current });
  if (JSON.stringify(refreshed.activities) !== JSON.stringify(preview.activities) || refreshed.vaultAfterSeconds !== preview.vaultAfterSeconds) {
    return { committed: false as const, reason: "changed" as const, preview: refreshed };
  }
  return { committed: true as const, preview: refreshed };
}
