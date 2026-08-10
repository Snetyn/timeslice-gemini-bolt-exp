import type {
  DailyProgressScope,
  DailyProgressView,
  DailyVisualModel,
  DailyVisualSegment,
} from "../domain/dailyVisual";

const formatDuration = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (hours) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
};

const statusLabel = (segment: DailyVisualSegment) => {
  if (segment.isFreeTime) return "Unscheduled";
  if (segment.status === "overtime") return "Overtime";
  if (segment.status === "active") return "Active";
  if (segment.status === "completed") return "Completed";
  return `${Math.round(segment.progress * 100)}% done`;
};

function DisplayControls({
  view,
  scope,
  onViewChange,
  onScopeChange,
}: {
  view: DailyProgressView;
  scope: DailyProgressScope;
  onViewChange: (view: DailyProgressView) => void;
  onScopeChange: (scope: DailyProgressScope) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Daily display options">
      <div
        className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1"
        role="group"
        aria-label="Daily progress view"
      >
        {(["linear", "circular"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => onViewChange(option)}
            className={`min-h-11 rounded-md px-2 text-xs font-semibold capitalize ${
              view === option
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <div
        className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1"
        role="group"
        aria-label="Daily progress scope"
      >
        {(
          [
            ["tasks", "Tasks only"],
            ["full", "Full day"],
          ] as const
        ).map(([option, label]) => (
          <button
            key={option}
            type="button"
            aria-pressed={scope === option}
            onClick={() => onScopeChange(option)}
            className={`min-h-11 rounded-md px-1 text-xs font-semibold ${
              scope === option
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LinearDailyProgress({
  model,
  animate,
}: {
  model: DailyVisualModel;
  animate: boolean;
}) {
  if (model.segments.length === 0)
    return (
      <div
        className="flex min-h-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm font-medium text-slate-500"
        aria-label="No planned Daily activities"
      >
        No planned activities
      </div>
    );
  return (
    <div
      className="flex min-h-16 w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-inner"
      role="img"
      aria-label={`${Math.round(model.progress * 100)}% of planned Daily work complete; ${formatDuration(model.totalRemainingSeconds)} remaining`}
    >
      {model.segments.map((segment) => (
        <div
          key={segment.id}
          data-testid={`daily-linear-segment-${segment.id}`}
          data-daily-color={segment.color}
          className={`relative min-w-0 overflow-hidden border-r border-white/80 last:border-r-0 ${
            segment.status === "active" || segment.status === "overtime"
              ? "ring-2 ring-inset ring-amber-400"
              : ""
          }`}
          style={{
            width: `${segment.share * 100}%`,
            background: segment.isFreeTime ? "#e2e8f0" : segment.color,
          }}
          title={`${segment.name}: ${formatDuration(segment.plannedSeconds)} · ${statusLabel(segment)}`}
        >
          {!segment.isFreeTime && (
            <div
              className={`absolute inset-y-0 left-0 bg-white/70 ${animate ? "transition-[width] duration-500" : ""}`}
              style={{ width: `${Math.max(0, 100 - segment.progress * 100)}%` }}
            />
          )}
          {segment.status === "completed" && !segment.isFreeTime && (
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, transparent 0, transparent 5px, white 5px, white 9px)",
              }}
            />
          )}
          {segment.share >= 0.09 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-1 text-center">
              <span className="max-w-full truncate rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold leading-tight text-slate-950 shadow-sm">
                {segment.name}
                {segment.share >= 0.15 && (
                  <span className="ml-1 font-medium text-slate-600">
                    {formatDuration(segment.plannedSeconds)}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CircularDailyProgress({ model }: { model: DailyVisualModel }) {
  let offset = 0;
  const progressPercent = Math.round(model.progress * 100);
  return (
    <div className="flex justify-center">
      <div className="relative h-[210px] w-[210px] max-w-full">
        <svg
          data-testid="daily-circular-display"
          viewBox="0 0 220 220"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={`${progressPercent}% of planned Daily work complete; ${formatDuration(model.totalRemainingSeconds)} remaining`}
        >
          <circle
            cx="110"
            cy="110"
            r="88"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="28"
          />
          {model.segments.map((segment) => {
            const start = offset;
            const length = Math.max(0, segment.share * 100);
            offset += length;
            return (
              <circle
                key={segment.id}
                cx="110"
                cy="110"
                r="88"
                pathLength="100"
                fill="none"
                stroke={segment.color}
                strokeWidth={
                  segment.status === "active" || segment.status === "overtime"
                    ? 32
                    : 28
                }
                strokeDasharray={`${length} ${Math.max(0, 100 - length)}`}
                strokeDashoffset={-start}
                transform="rotate(-90 110 110)"
              >
                <title>
                  {segment.name}: {formatDuration(segment.plannedSeconds)} ·{" "}
                  {statusLabel(segment)}
                </title>
              </circle>
            );
          })}
          <circle
            cx="110"
            cy="110"
            r="60"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="12"
          />
          <circle
            cx="110"
            cy="110"
            r="60"
            pathLength="100"
            fill="none"
            stroke="#2563eb"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${model.progress * 100} 100`}
            transform="rotate(-90 110 110)"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <strong className="text-3xl tabular-nums text-slate-950">
            {progressPercent}%
          </strong>
          <span className="text-xs font-medium text-slate-500">complete</span>
          <span className="mt-1 text-xs font-bold text-slate-700">
            {formatDuration(model.totalRemainingSeconds)} left
          </span>
        </div>
      </div>
    </div>
  );
}

function DailyLegend({ model }: { model: DailyVisualModel }) {
  if (model.segments.length === 0) return null;
  return (
    <ul
      className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
      aria-label="Daily activity legend"
    >
      {model.segments.map((segment) => (
        <li
          key={segment.id}
          className="grid min-h-9 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 text-xs"
        >
          <span
            className="h-3 w-3 rounded-full ring-1 ring-black/10"
            style={{ background: segment.color }}
          />
          <span className="min-w-0 truncate font-semibold text-slate-800">
            {segment.name}
          </span>
          <span className="whitespace-nowrap tabular-nums text-slate-600">
            {segment.isFreeTime
              ? formatDuration(segment.plannedSeconds)
              : `${formatDuration(segment.remainingSeconds)} / ${formatDuration(segment.plannedSeconds)} · ${statusLabel(segment)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DailyProgressDisplay({
  model,
  view,
  scope,
  animate,
  hideCompleted = false,
  onViewChange,
  onScopeChange,
  onHideCompletedChange,
}: {
  model: DailyVisualModel;
  view: DailyProgressView;
  scope: DailyProgressScope;
  animate: boolean;
  hideCompleted?: boolean;
  onViewChange: (view: DailyProgressView) => void;
  onScopeChange: (scope: DailyProgressScope) => void;
  onHideCompletedChange?: (hide: boolean) => void;
}) {
  return (
    <section className="space-y-3" aria-labelledby="daily-progress-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="daily-progress-title" className="text-base font-semibold">
          Task overview
        </h3>
        <div className="flex items-center gap-3">
          {onHideCompletedChange && (
            <label className="flex min-h-11 cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(event) =>
                  onHideCompletedChange(event.currentTarget.checked)
                }
              />
              Hide completed
            </label>
          )}
          <span className="text-sm font-bold text-emerald-700">
            {Math.round(model.progress * 100)}% complete
          </span>
        </div>
      </div>
      <DisplayControls
        view={view}
        scope={scope}
        onViewChange={onViewChange}
        onScopeChange={onScopeChange}
      />
      {view === "circular" ? (
        <CircularDailyProgress model={model} />
      ) : (
        <LinearDailyProgress model={model} animate={animate} />
      )}
      <DailyLegend model={model} />
      {model.overbookedSeconds > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Planned work exceeds the remaining day by{" "}
          {formatDuration(model.overbookedSeconds)}.
        </p>
      )}
    </section>
  );
}
