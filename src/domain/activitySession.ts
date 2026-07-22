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
  source: ActivitySessionSource;
  kind: ActivitySessionKind;
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
    source,
    kind,
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
