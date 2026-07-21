import type { CSSProperties } from "react";

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

const minutes = (seconds: number) =>
  `${Math.max(0, Math.round(seconds / 60))}m`;

export function SessionReportModal({
  report,
  onClose,
  history = [],
  onSelectHistory,
}: {
  report: SessionReport;
  onClose: () => void;
  history?: Array<{
    id: string;
    value: { completedAtMs: number; report: SessionReport };
  }>;
  onSelectHistory?: (report: SessionReport) => void;
}) {
  const planned = Math.max(0, report.totals.planned);
  const actual = Math.max(0, report.totals.actual);
  const total = Math.max(1, planned + actual);
  const plannedShare = (planned / total) * 100;
  const deltaPositive = report.totals.delta >= 0;
  const donutStyle = {
    background: `conic-gradient(#38bdf8 0 ${plannedShare}%, #8b5cf6 ${plannedShare}% 100%)`,
  } as CSSProperties;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/45 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-report-title"
    >
      <div className="w-full max-w-2xl rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Session complete
            </p>
            <h2
              id="session-report-title"
              className="text-xl font-bold text-slate-900"
            >
              Session Report
            </h2>
          </div>
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Close session report"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-[9rem_1fr] items-center gap-5 rounded-xl bg-slate-50 p-4 sm:grid-cols-[11rem_1fr]">
          <div
            className="relative mx-auto h-32 w-32 rounded-full sm:h-40 sm:w-40"
            style={donutStyle}
            aria-label={`Planned ${minutes(planned)}, actual ${minutes(actual)}`}
          >
            <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white text-center sm:inset-5">
              <span className="text-xs text-slate-500">Actual / plan</span>
              <strong className="text-xl text-slate-900">
                {Math.round(report.totals.pct)}%
              </strong>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-sky-50 p-2">
                <span className="block text-xs text-sky-700">Planned</span>
                <strong>{minutes(planned)}</strong>
              </div>
              <div className="rounded-lg bg-violet-50 p-2">
                <span className="block text-xs text-violet-700">Actual</span>
                <strong>{minutes(actual)}</strong>
              </div>
            </div>
            <p
              className={`text-sm font-semibold ${deltaPositive ? "text-emerald-700" : "text-rose-700"}`}
            >
              {deltaPositive ? "+" : "−"}
              {minutes(Math.abs(report.totals.delta))} against plan
            </p>
            {report.totals.overtime > 0 && (
              <p className="text-xs text-amber-700">
                Overtime: {minutes(report.totals.overtime)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
          {report.rows
            .slice()
            .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
            .map((row) => {
              const scale = Math.max(row.planned, row.actual, 1);
              const plannedWidth = Math.min(100, (row.planned / scale) * 100);
              const actualWidth = Math.min(100, (row.actual / scale) * 100);
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-slate-800">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: row.color || "#64748b" }}
                      />
                      {row.name}
                    </span>
                    <span
                      className={`shrink-0 font-semibold ${row.delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                    >
                      {row.delta >= 0 ? "+" : "−"}
                      {minutes(Math.abs(row.delta))}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="w-11">Plan</span>
                      <div className="h-2 flex-1 rounded bg-sky-100">
                        <div
                          className="h-full rounded bg-sky-400"
                          style={{ width: `${plannedWidth}%` }}
                        />
                      </div>
                      <span>{minutes(row.planned)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-11">Actual</span>
                      <div className="h-2 flex-1 rounded bg-violet-100">
                        <div
                          className="h-full rounded bg-violet-500"
                          style={{ width: `${actualWidth}%` }}
                        />
                      </div>
                      <span>{minutes(row.actual)}</span>
                    </div>
                  </div>
                  {(row.drainedSeconds > 0 || row.receivedOvertime > 0) && (
                    <details className="mt-2 text-xs text-slate-500">
                      <summary className="cursor-pointer">
                        Transfer details
                      </summary>
                      <p className="mt-1">
                        Donated: {minutes(row.drainedSeconds)} · Received:{" "}
                        {minutes(row.receivedOvertime)}
                      </p>
                    </details>
                  )}
                </div>
              );
            })}
        </div>
        {history.length > 0 && (
          <details className="mt-4 rounded-lg border border-slate-200 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-700">
              Recent sessions ({history.length})
            </summary>
            <div className="mt-2 space-y-2">
              {history.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md bg-slate-50 px-2 py-2 text-left hover:bg-slate-100"
                  onClick={() => onSelectHistory?.(item.value.report)}
                >
                  <span>
                    {new Date(item.value.completedAtMs).toLocaleString()}
                  </span>
                  <span className="font-semibold">
                    {Math.round(item.value.report.totals.pct)}%
                  </span>
                </button>
              ))}
            </div>
          </details>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
