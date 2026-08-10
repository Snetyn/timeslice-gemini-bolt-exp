import { readableActivityColor, type ColorIntensity } from "./activityColor";

export type DailyProgressView = "linear" | "circular";
export type DailyProgressScope = "tasks" | "full";
export type DailyVisualStatus =
  "scheduled" | "active" | "overtime" | "completed";

export type DailyVisualActivity = {
  id: string;
  name: string;
  color?: string;
  plannedSeconds: number;
  actualSeconds: number;
  status?: string;
};

export type DailyVisualSegment = {
  id: string;
  name: string;
  color: string;
  textColor: "#ffffff" | "#0f172a";
  plannedSeconds: number;
  actualSeconds: number;
  remainingSeconds: number;
  creditedSeconds: number;
  progress: number;
  share: number;
  status: DailyVisualStatus;
  isFreeTime: boolean;
};

export type DailyVisualModel = {
  segments: DailyVisualSegment[];
  taskSegments: DailyVisualSegment[];
  totalPlannedSeconds: number;
  totalActualSeconds: number;
  totalCreditedSeconds: number;
  totalRemainingSeconds: number;
  capacitySeconds: number;
  freeSeconds: number;
  overbookedSeconds: number;
  progress: number;
  scope: DailyProgressScope;
};

const finiteSeconds = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const normalizeStatus = (status?: string): DailyVisualStatus => {
  if (status === "active" || status === "overtime" || status === "completed")
    return status;
  return "scheduled";
};

export function buildDailyVisualModel(options: {
  activities: DailyVisualActivity[];
  scope: DailyProgressScope;
  capacitySeconds?: number;
  hideCompleted?: boolean;
  colorIntensity?: ColorIntensity;
}): DailyVisualModel {
  const scope = options.scope;
  const capacitySeconds = finiteSeconds(options.capacitySeconds || 0);
  const taskSegments = options.activities
    .filter((activity) => activity && typeof activity.id === "string")
    .map((activity) => {
      const status = normalizeStatus(activity.status);
      const plannedSeconds = finiteSeconds(activity.plannedSeconds);
      const actualSeconds = finiteSeconds(activity.actualSeconds);
      const completed = status === "completed";
      const creditedSeconds = completed
        ? plannedSeconds
        : Math.min(plannedSeconds, actualSeconds);
      const displayColor = readableActivityColor(
        activity.color,
        activity.id || activity.name,
        options.colorIntensity || "standard",
      );
      return {
        id: activity.id,
        name: String(activity.name || "Untitled activity"),
        color: displayColor.color,
        textColor: displayColor.textColor,
        plannedSeconds,
        actualSeconds,
        remainingSeconds: Math.max(0, plannedSeconds - creditedSeconds),
        creditedSeconds,
        progress:
          plannedSeconds > 0
            ? Math.min(1, creditedSeconds / plannedSeconds)
            : completed
              ? 1
              : 0,
        share: 0,
        status,
        isFreeTime: false,
      } satisfies DailyVisualSegment;
    })
    .filter(
      (activity) =>
        activity.plannedSeconds > 0 &&
        !(options.hideCompleted && activity.status === "completed"),
    );

  const totalPlannedSeconds = taskSegments.reduce(
    (sum, segment) => sum + segment.plannedSeconds,
    0,
  );
  const totalActualSeconds = taskSegments.reduce(
    (sum, segment) => sum + segment.actualSeconds,
    0,
  );
  const totalCreditedSeconds = taskSegments.reduce(
    (sum, segment) => sum + segment.creditedSeconds,
    0,
  );
  const totalRemainingSeconds = taskSegments.reduce(
    (sum, segment) => sum + segment.remainingSeconds,
    0,
  );
  const freeSeconds =
    scope === "full" ? Math.max(0, capacitySeconds - totalPlannedSeconds) : 0;
  const overbookedSeconds =
    scope === "full" ? Math.max(0, totalPlannedSeconds - capacitySeconds) : 0;
  const geometrySeconds = Math.max(
    1,
    scope === "full"
      ? Math.max(capacitySeconds, totalPlannedSeconds)
      : totalPlannedSeconds,
  );
  const segments: DailyVisualSegment[] = taskSegments.map((segment) => ({
    ...segment,
    share: segment.plannedSeconds / geometrySeconds,
  }));
  if (scope === "full" && freeSeconds > 0) {
    segments.push({
      id: "daily-free-time",
      name: "Free time",
      color: "#cbd5e1",
      textColor: "#0f172a",
      plannedSeconds: freeSeconds,
      actualSeconds: 0,
      remainingSeconds: freeSeconds,
      creditedSeconds: 0,
      progress: 0,
      share: freeSeconds / geometrySeconds,
      status: "scheduled",
      isFreeTime: true,
    });
  }

  return {
    segments,
    taskSegments: segments.filter((segment) => !segment.isFreeTime),
    totalPlannedSeconds,
    totalActualSeconds,
    totalCreditedSeconds,
    totalRemainingSeconds,
    capacitySeconds,
    freeSeconds,
    overbookedSeconds,
    progress:
      totalPlannedSeconds > 0
        ? Math.min(1, totalCreditedSeconds / totalPlannedSeconds)
        : 0,
    scope,
  };
}
