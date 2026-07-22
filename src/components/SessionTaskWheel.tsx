import type { CSSProperties } from "react";
import {
  buildReportWheelSegments,
  getVisibleArcLength,
  type ReportWheelSegment,
  type SessionReport,
} from "../lib/sessionReport";

const minutes = (seconds: number) =>
  `${Math.max(0, Math.round(seconds / 60))}m`;

const signedMinutes = (seconds: number) =>
  `${seconds >= 0 ? "+" : "−"}${minutes(Math.abs(seconds))}`;

function RingSegments({
  segments,
  value,
  radius,
  strokeWidth,
}: {
  segments: ReportWheelSegment[];
  value: "planned" | "actual";
  radius: number;
  strokeWidth: number;
}) {
  const shareKey = value === "planned" ? "plannedShare" : "actualShare";
  const offsetKey = value === "planned" ? "plannedOffset" : "actualOffset";
  const visibleSegments = segments.filter((segment) => segment[shareKey] > 0);

  return visibleSegments.map((segment) => {
    const share = segment[shareKey];
    const visible = getVisibleArcLength(share, visibleSegments.length);
    return (
      <circle
        key={`${value}-${segment.id}`}
        cx="110"
        cy="110"
        r={radius}
        fill="none"
        pathLength="100"
        stroke={segment.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${visible} ${100 - visible}`}
        strokeDashoffset={-segment[offsetKey]}
        strokeLinecap={visibleSegments.length > 1 ? "round" : "butt"}
        transform="rotate(-90 110 110)"
        aria-hidden="true"
      />
    );
  });
}

export function SessionTaskWheel({ report }: { report: SessionReport }) {
  const segments = buildReportWheelSegments(report.rows);
  const planned = Math.max(0, Number(report.totals?.planned) || 0);
  const actual = Math.max(0, Number(report.totals?.actual) || 0);
  const delta = actual - planned;
  const percentage = planned > 0 ? Math.round((actual / planned) * 100) : null;
  const centerValue =
    percentage !== null ? `${percentage}%` : actual > 0 ? "Open-ended" : "—";
  const wheelLabel = `Task wheel. Outer ring shows ${minutes(planned)} planned. Inner ring shows ${minutes(actual)} actual across ${segments.length} tasks.`;

  return (
    <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[14rem_1fr] sm:items-center sm:p-4">
      <div className="mx-auto w-full max-w-[13.75rem]">
        <svg
          viewBox="0 0 220 220"
          className="block h-auto w-full"
          role="img"
          aria-label={wheelLabel}
        >
          <title>Planned and actual task distribution</title>
          <desc>{wheelLabel}</desc>
          <circle
            cx="110"
            cy="110"
            r="88"
            fill="none"
            stroke="#dbe3ef"
            strokeWidth="18"
          />
          <circle
            cx="110"
            cy="110"
            r="60"
            fill="none"
            stroke="#e8edf5"
            strokeWidth="18"
          />
          <RingSegments
            segments={segments}
            value="planned"
            radius={88}
            strokeWidth={18}
          />
          <RingSegments
            segments={segments}
            value="actual"
            radius={60}
            strokeWidth={18}
          />
          <text
            x="110"
            y="101"
            textAnchor="middle"
            className="fill-slate-500 text-[11px]"
          >
            Actual / plan
          </text>
          <text
            x="110"
            y="122"
            textAnchor="middle"
            className="fill-slate-900 text-[20px] font-bold"
          >
            {centerValue}
          </text>
          <text
            x="110"
            y="138"
            textAnchor="middle"
            className="fill-slate-500 text-[9px]"
          >
            {signedMinutes(delta)}
          </text>
        </svg>
        <div className="mt-1 flex justify-center gap-3 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <i
              className="block h-2.5 w-2.5 rounded-full border-2 border-slate-500"
              aria-hidden="true"
            />
            Outer: Plan
          </span>
          <span className="inline-flex items-center gap-1">
            <i
              className="block h-2.5 w-2.5 rounded-full bg-slate-500"
              aria-hidden="true"
            />
            Inner: Actual
          </span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tasks
        </p>
        {segments.length > 0 ? (
          <ul
            className="max-h-36 space-y-1.5 overflow-y-auto pr-1"
            aria-label="Task wheel legend"
          >
            {segments.map((segment) => (
              <li
                key={segment.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-white px-2 py-1.5 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <i
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color } as CSSProperties}
                    aria-hidden="true"
                  />
                  <span className="truncate font-semibold text-slate-800">
                    {segment.name}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    P {minutes(segment.planned)} · A {minutes(segment.actual)}
                  </span>
                </span>
                <span
                  className={`font-semibold ${segment.delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {signedMinutes(segment.delta)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-white px-3 py-4 text-center text-xs text-slate-500">
            No timed tasks in this report.
          </p>
        )}
      </div>
    </div>
  );
}
