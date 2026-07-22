export const REPORT_FALLBACK_COLOR = "#64748b";

export type SessionReportView = "summary" | "tasks";

export type SessionReportRow = {
  id: string;
  name: string;
  color?: string;
  planned: number;
  actual: number;
  delta: number;
  overtimeSeconds: number;
  drainedSeconds: number;
  receivedOvertime: number;
};

export type SessionReport = {
  rows: SessionReportRow[];
  totals: {
    planned: number;
    actual: number;
    delta: number;
    pct: number;
    overtime: number;
    drained: number;
    received: number;
  };
};

export type ReportWheelSegment = {
  id: string;
  name: string;
  color: string;
  planned: number;
  actual: number;
  delta: number;
  plannedShare: number;
  actualShare: number;
  plannedOffset: number;
  actualOffset: number;
};

const safeSeconds = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

export function buildReportWheelSegments(
  rows: SessionReportRow[] | null | undefined,
): ReportWheelSegment[] {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const planned = safeSeconds(row?.planned);
      const actual = safeSeconds(row?.actual);
      return {
        id:
          typeof row?.id === "string" && row.id.trim()
            ? row.id
            : `task-${index + 1}`,
        name:
          typeof row?.name === "string" && row.name.trim()
            ? row.name.trim()
            : `Task ${index + 1}`,
        color:
          typeof row?.color === "string" && row.color.trim()
            ? row.color
            : REPORT_FALLBACK_COLOR,
        planned,
        actual,
        delta: actual - planned,
      };
    })
    .filter((row) => row.planned > 0 || row.actual > 0);

  const totalPlanned = normalized.reduce((sum, row) => sum + row.planned, 0);
  const totalActual = normalized.reduce((sum, row) => sum + row.actual, 0);
  let plannedOffset = 0;
  let actualOffset = 0;

  return normalized.map((row) => {
    const plannedShare =
      totalPlanned > 0 ? (row.planned / totalPlanned) * 100 : 0;
    const actualShare = totalActual > 0 ? (row.actual / totalActual) * 100 : 0;
    const segment = {
      ...row,
      plannedShare,
      actualShare,
      plannedOffset,
      actualOffset,
    };
    plannedOffset += plannedShare;
    actualOffset += actualShare;
    return segment;
  });
}

export function getVisibleArcLength(share: number, segmentCount: number) {
  if (!Number.isFinite(share) || share <= 0) return 0;
  if (segmentCount <= 1) return Math.min(100, share);
  const gap = Math.min(1, share * 0.28);
  return Math.max(share - gap, Math.min(share, 0.08));
}

export const normalizeReportView = (value: unknown): SessionReportView =>
  value === "tasks" ? "tasks" : "summary";
