export type ActivitySessionSource = "session" | "daily" | "single";

export type ActivitySessionKind =
  "countdown" | "count-up" | "overtime" | "standard";

export type ActivitySessionEndReason =
  | "automatic"
  | "switched"
  | "paused"
  | "completed"
  | "reset"
  | "cancelled"
  | "exited"
  | "flow-break";

export type ActivitySessionContext = {
  activityId: string;
  activityName: string;
  activityColor?: string;
  sourceKey?: string;
  source: ActivitySessionSource;
  kind: ActivitySessionKind;
  activityDefinitionId?: string;
  lifeAreaId?: string;
  lifeAreaName?: string;
  lifeAreaColor?: string;
  classificationSource?: "recorded" | "legacy-adoption" | "corrected";
  classifiedAtMs?: number;
};

export type ActivityClassificationAudit = {
  correctedAtMs: number;
  previousActivityDefinitionId?: string;
  previousLifeAreaId?: string;
  previousLifeAreaName?: string;
  nextActivityDefinitionId?: string;
  nextLifeAreaId?: string;
  nextLifeAreaName?: string;
  reason: "legacy-adoption" | "correction";
};

export type ActivitySessionCorrection = {
  correctedAtMs: number;
  previousActivityName: string;
  previousStartedAtMs: number;
  previousEndedAtMs: number;
  previousDurationMs: number;
};

export type ActivitySessionRecord = ActivitySessionContext & {
  id: string;
  sourceTimerId: string;
  status: "running" | "completed";
  startedAtMs: number;
  endedAtMs: number | null;
  durationMs: number;
  endReason?: ActivitySessionEndReason;
  deletedAtMs?: number;
  corrections: ActivitySessionCorrection[];
  classificationCorrections: ActivityClassificationAudit[];
  revision: number;
  createdAtMs: number;
  updatedAtMs: number;
};

const finiteInteger = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const SOURCES = new Set<ActivitySessionSource>(["session", "daily", "single"]);
const KINDS = new Set<ActivitySessionKind>([
  "countdown",
  "count-up",
  "overtime",
  "standard",
]);

export function normalizeActivitySessionContext(
  value: unknown,
): ActivitySessionContext | null {
  if (!isRecord(value)) return null;
  const activityId =
    typeof value.activityId === "string" ? value.activityId.trim() : "";
  const activityName =
    typeof value.activityName === "string" ? value.activityName.trim() : "";
  const source = value.source as ActivitySessionSource;
  const kind = value.kind as ActivitySessionKind;
  if (
    !activityId ||
    !activityName ||
    !SOURCES.has(source) ||
    !KINDS.has(kind)
  ) {
    return null;
  }
  return {
    activityId,
    activityName,
    activityColor:
      typeof value.activityColor === "string" && value.activityColor.trim()
        ? value.activityColor
        : undefined,
    sourceKey:
      typeof value.sourceKey === "string" && value.sourceKey.trim()
        ? value.sourceKey.trim()
        : undefined,
    source,
    kind,
    activityDefinitionId:
      typeof value.activityDefinitionId === "string" && value.activityDefinitionId.trim()
        ? value.activityDefinitionId
        : undefined,
    lifeAreaId:
      typeof value.lifeAreaId === "string" && value.lifeAreaId.trim()
        ? value.lifeAreaId
        : undefined,
    lifeAreaName:
      typeof value.lifeAreaName === "string" && value.lifeAreaName.trim()
        ? value.lifeAreaName
        : undefined,
    lifeAreaColor:
      typeof value.lifeAreaColor === "string" && value.lifeAreaColor.trim()
        ? value.lifeAreaColor
        : undefined,
    classificationSource:
      value.classificationSource === "legacy-adoption" || value.classificationSource === "corrected"
        ? value.classificationSource
        : value.classificationSource === "recorded"
          ? "recorded"
          : undefined,
    classifiedAtMs:
      value.classifiedAtMs === undefined
        ? undefined
        : finiteInteger(value.classifiedAtMs),
  };
}

export function normalizeActivitySessionRecord(
  value: unknown,
): ActivitySessionRecord | null {
  if (!isRecord(value)) return null;
  const context = normalizeActivitySessionContext(value);
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const sourceTimerId =
    typeof value.sourceTimerId === "string" ? value.sourceTimerId.trim() : "";
  if (!context || !id || !sourceTimerId) return null;

  const startedAtMs = finiteInteger(value.startedAtMs);
  const rawEndedAtMs =
    value.endedAtMs === null
      ? null
      : finiteInteger(value.endedAtMs, startedAtMs);
  const status = value.status === "running" ? "running" : "completed";
  const endedAtMs =
    status === "running"
      ? null
      : Math.max(startedAtMs, rawEndedAtMs || startedAtMs);
  const corrections = Array.isArray(value.corrections)
    ? value.corrections.filter(isRecord).map((correction) => ({
        correctedAtMs: finiteInteger(correction.correctedAtMs),
        previousActivityName: String(correction.previousActivityName || ""),
        previousStartedAtMs: finiteInteger(correction.previousStartedAtMs),
        previousEndedAtMs: finiteInteger(correction.previousEndedAtMs),
        previousDurationMs: finiteInteger(correction.previousDurationMs),
      }))
    : [];
  const classificationCorrections = Array.isArray(value.classificationCorrections)
    ? value.classificationCorrections.filter(isRecord).map((correction) => ({
        correctedAtMs: finiteInteger(correction.correctedAtMs),
        previousActivityDefinitionId:
          typeof correction.previousActivityDefinitionId === "string" ? correction.previousActivityDefinitionId : undefined,
        previousLifeAreaId:
          typeof correction.previousLifeAreaId === "string" ? correction.previousLifeAreaId : undefined,
        previousLifeAreaName:
          typeof correction.previousLifeAreaName === "string" ? correction.previousLifeAreaName : undefined,
        nextActivityDefinitionId:
          typeof correction.nextActivityDefinitionId === "string" ? correction.nextActivityDefinitionId : undefined,
        nextLifeAreaId:
          typeof correction.nextLifeAreaId === "string" ? correction.nextLifeAreaId : undefined,
        nextLifeAreaName:
          typeof correction.nextLifeAreaName === "string" ? correction.nextLifeAreaName : undefined,
        reason: correction.reason === "legacy-adoption" ? "legacy-adoption" as const : "correction" as const,
      }))
    : [];

  return {
    ...context,
    id,
    sourceTimerId,
    status,
    startedAtMs,
    endedAtMs,
    durationMs:
      status === "running"
        ? 0
        : finiteInteger(
            value.durationMs,
            Math.max(0, (endedAtMs || 0) - startedAtMs),
          ),
    endReason:
      typeof value.endReason === "string"
        ? (value.endReason as ActivitySessionEndReason)
        : undefined,
    deletedAtMs:
      value.deletedAtMs === undefined
        ? undefined
        : finiteInteger(value.deletedAtMs),
    corrections,
    classificationCorrections,
    revision: finiteInteger(value.revision),
    createdAtMs: finiteInteger(value.createdAtMs, startedAtMs),
    updatedAtMs: finiteInteger(value.updatedAtMs, startedAtMs),
  };
}

export const activitySessionDurationMs = (
  session: ActivitySessionRecord,
  nowMs = Date.now(),
) =>
  session.status === "running"
    ? Math.max(0, finiteInteger(nowMs) - session.startedAtMs)
    : finiteInteger(session.durationMs);

export const adHocActivityId = (name: string) => {
  const normalized = name.trim().toLocaleLowerCase().replace(/\s+/g, "-");
  return `adhoc:${encodeURIComponent(normalized || "activity")}`;
};
