import { useMemo, useState } from "react";
import {
  buildTagRatioModel,
  type TagChartView,
  type TagInsightTag,
  type TagMatchMode,
  type TagRatioActivity,
  type TagRatioMetric,
  type TagRatioSegment,
  type TagRpgLevel,
} from "../domain/tagInsights";

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const rest = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest.toString().padStart(2, "0")}s`;
  return `${rest}s`;
};

function Donut({
  segments,
  totalSeconds,
}: {
  segments: TagRatioSegment[];
  totalSeconds: number;
}) {
  const radius = 45;
  const circumference = Math.PI * 2 * radius;
  let offset = 0;
  const summary = `Tag ${segments.length === 1 ? "ratio" : "ratios"}. Total ${formatDuration(totalSeconds)}. ${segments
    .map(
      (segment) => `${segment.name} ${Math.round(segment.ratio * 100)} percent`,
    )
    .join(", ")}`;
  return (
    <svg
      viewBox="0 0 120 120"
      className="mx-auto h-[190px] w-[190px] max-w-full"
      role="img"
      aria-label={summary}
      data-testid="tag-ratio-donut"
    >
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="15"
      />
      {totalSeconds > 0 &&
        segments.map((segment) => {
          const length = Math.max(0, segment.ratio * circumference);
          const currentOffset = offset;
          offset += length;
          if (length <= 0) return null;
          return (
            <circle
              key={segment.id}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="15"
              strokeDasharray={`${length} ${Math.max(0, circumference - length)}`}
              strokeDashoffset={-currentOffset}
              transform="rotate(-90 60 60)"
              strokeLinecap="butt"
            />
          );
        })}
      <text
        x="60"
        y="55"
        textAnchor="middle"
        className="fill-slate-500 text-[9px] font-semibold uppercase"
      >
        selected
      </text>
      <text
        x="60"
        y="70"
        textAnchor="middle"
        className="fill-slate-900 text-[12px] font-bold"
      >
        {formatDuration(totalSeconds)}
      </text>
    </svg>
  );
}

const radarPoint = (
  index: number,
  count: number,
  value: number,
  radius = 46,
) => {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  const distance = radius * Math.max(0, Math.min(1, value));
  return `${60 + Math.cos(angle) * distance},${60 + Math.sin(angle) * distance}`;
};

function Radar({
  values,
  label,
  testId,
}: {
  values: Array<{
    id: string;
    name: string;
    color: string;
    value: number;
    display: string;
  }>;
  label: string;
  testId: string;
}) {
  if (values.length === 0)
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-600">
        No tag values are available for this chart yet.
      </p>
    );

  // A polygon needs at least three points. Mirroring one or two real axes keeps
  // the chart useful for small selections without inventing another tag/value.
  const chartValues =
    values.length === 1
      ? [values[0], values[0], values[0], values[0]]
      : values.length === 2
        ? [values[0], values[1], values[0], values[1]]
        : values;
  const axes = chartValues.map((_, index) =>
    radarPoint(index, chartValues.length, 1),
  );
  const points = chartValues
    .map((item, index) => radarPoint(index, chartValues.length, item.value))
    .join(" ");
  return (
    <div className="mx-auto w-[220px] max-w-full">
      <svg
        viewBox="-12 -12 144 144"
        className="h-auto w-full"
        role="img"
        aria-label={`${label}. ${values.map((item) => `${item.name}: ${item.display}`).join(", ")}`}
        data-testid={testId}
      >
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={chartValues
              .map((_, index) => radarPoint(index, chartValues.length, scale))
              .join(" ")}
            fill={scale === 1 ? "#f8fafc" : "none"}
            stroke="#cbd5e1"
            strokeWidth="0.7"
          />
        ))}
        {axes.map((point, index) => (
          <line
            key={`${chartValues[index].id}-${index}`}
            x1="60"
            y1="60"
            x2={point.split(",")[0]}
            y2={point.split(",")[1]}
            stroke={chartValues[index].color}
            strokeOpacity="0.45"
            strokeWidth="0.9"
          />
        ))}
        <polygon
          points={points}
          fill="rgba(99,102,241,.24)"
          stroke="#4f46e5"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {chartValues.map((item, index) => {
          const [cx, cy] = radarPoint(
            index,
            chartValues.length,
            item.value,
          ).split(",");
          return (
            <circle
              key={`${item.id}-${index}`}
              cx={cx}
              cy={cy}
              r="2.3"
              fill={item.color}
              stroke="white"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div
        className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-700"
        aria-hidden="true"
      >
        {values.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name} · {item.display}
          </span>
        ))}
      </div>
    </div>
  );
}

function RatioBars({ segments }: { segments: TagRatioSegment[] }) {
  return (
    <div className="space-y-2" aria-label="Tag ratio values">
      {segments.map((segment) => {
        const percent = segment.ratio * 100;
        return (
          <div
            key={segment.id}
            className="rounded-lg border border-slate-200 bg-white p-2"
          >
            <div className="mb-1 flex items-baseline gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                {segment.name}
              </span>
              <strong className="text-lg tabular-nums text-slate-900">
                {percent.toFixed(percent > 0 && percent < 10 ? 1 : 0)}%
              </strong>
              <span className="text-xs tabular-nums text-slate-500">
                {formatDuration(segment.seconds)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, percent))}%`,
                  backgroundColor: segment.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RpgView({ levels }: { levels: TagRpgLevel[] }) {
  const maximum = Math.max(
    1,
    ...levels.map((item) => item.level + item.progress),
  );
  return (
    <div className="space-y-2">
      <Radar
        values={levels.map((item) => ({
          id: item.id,
          name: item.name,
          color: item.color,
          value: (item.level + item.progress) / maximum,
          display: `Level ${item.level}`,
        }))}
        label="All-time tag RPG levels"
        testId="tag-rpg-radar"
      />
      <div className="grid gap-2 sm:grid-cols-2" aria-label="Tag RPG levels">
        {levels.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border border-slate-200 bg-white p-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">
                {item.name}
              </span>
              <strong className="text-sm text-indigo-700">
                Level {item.level}
              </strong>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${item.progress * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>{formatDuration(item.attributedSeconds)} total</span>
              <span>{formatDuration(item.secondsToNextLevel)} to next</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function TagRatioPanel({
  mode,
  activities,
  tags,
  selectedTagIds,
  onSelectionChange,
  metric,
  matchMode,
  view,
  onMetricChange,
  onMatchModeChange,
  onViewChange,
  rpgLevels,
  historyError,
  rpgMinutesPerLevel,
  onRpgMinutesPerLevelChange,
}: {
  mode: "session" | "daily";
  activities: readonly TagRatioActivity[];
  tags: readonly TagInsightTag[];
  selectedTagIds: readonly string[];
  onSelectionChange: (ids: string[]) => void;
  metric: TagRatioMetric;
  matchMode: TagMatchMode;
  view: TagChartView;
  onMetricChange: (value: TagRatioMetric) => void;
  onMatchModeChange: (value: TagMatchMode) => void;
  onViewChange: (value: TagChartView) => void;
  rpgLevels: TagRpgLevel[];
  historyError?: unknown;
  rpgMinutesPerLevel: number;
  onRpgMinutesPerLevelChange: (value: number) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleTags = useMemo(
    () =>
      tags
        .filter((tag) => tag.id && tag.name)
        .filter(
          (tag) =>
            !normalizedQuery ||
            tag.name.toLocaleLowerCase().includes(normalizedQuery),
        )
        .sort((left, right) => {
          const leftSelected = selectedTagIds.includes(left.id) ? 0 : 1;
          const rightSelected = selectedTagIds.includes(right.id) ? 0 : 1;
          return (
            leftSelected - rightSelected || left.name.localeCompare(right.name)
          );
        }),
    [normalizedQuery, selectedTagIds, tags],
  );
  const model = useMemo(
    () =>
      buildTagRatioModel({
        activities,
        tags,
        selectedTagIds,
        metric,
        matchMode,
      }),
    [activities, matchMode, metric, selectedTagIds, tags],
  );

  return (
    <section
      className="space-y-2 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-indigo-50/40 p-2.5"
      aria-label={`${mode === "session" ? "Session" : "Daily"} tag ratios`}
      data-testid={`${mode}-tag-ratio-panel`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Tag balance</h3>
          <p className="text-[11px] text-slate-500">
            Charts only · tasks stay visible
          </p>
        </div>
        {selectedTagIds.length > 0 && (
          <button
            type="button"
            className="min-h-11 rounded-lg px-3 text-xs font-semibold text-indigo-700"
            onClick={() => onSelectionChange([])}
          >
            Clear
          </button>
        )}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search tags…"
        aria-label="Search tags"
        className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div
        className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto"
        aria-label="Choose tags"
      >
        {visibleTags.map((tag) => {
          const selected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onSelectionChange(
                  selected
                    ? selectedTagIds.filter((id) => id !== tag.id)
                    : [...selectedTagIds, tag.id],
                )
              }
              className={`min-h-11 rounded-full border px-3 text-xs font-semibold transition-colors ${selected ? "border-indigo-500 bg-indigo-100 text-indigo-900" : "border-slate-200 bg-white text-slate-700"}`}
            >
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </button>
          );
        })}
        {visibleTags.length === 0 && (
          <p className="py-2 text-xs text-slate-500">No matching tags.</p>
        )}
      </div>

      {selectedTagIds.length === 0 ? (
        <div className="rounded-lg bg-white/80 p-3 text-center text-sm text-slate-600">
          Select one or more tags to compare their time ratios.
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
            aria-label="Tag chart view"
          >
            {(
              [
                ["donut", "Donut"],
                ["radar", "Radar"],
                ["rpg", "RPG"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => onViewChange(value)}
                className={`min-h-11 rounded-md text-xs font-bold ${view === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {view !== "rpg" && (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[2fr_1fr]">
              <div
                className="grid grid-cols-3 rounded-lg bg-slate-100 p-1"
                aria-label="Tag ratio metric"
              >
                {(["plan", "remaining", "actual"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={metric === value}
                    onClick={() => onMetricChange(value)}
                    className={`min-h-11 rounded-md text-[11px] font-bold capitalize ${metric === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div
                className="grid grid-cols-2 rounded-lg bg-slate-100 p-1"
                aria-label="Tag match mode"
              >
                {(["any", "all"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={matchMode === value}
                    onClick={() => onMatchModeChange(value)}
                    className={`min-h-11 rounded-md text-xs font-bold capitalize ${matchMode === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === "donut" && (
            <Donut
              segments={model.segments}
              totalSeconds={model.totalSeconds}
            />
          )}
          {view === "radar" && (
            <Radar
              values={model.segments.map((segment) => ({
                id: segment.id,
                name: segment.name,
                color: segment.color,
                value: segment.ratio,
                display: `${(segment.ratio * 100).toFixed(1)}%`,
              }))}
              label={`${metric} tag ratios`}
              testId="tag-ratio-radar"
            />
          )}
          {view === "rpg" ? (
            <div className="space-y-2">
              <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-white px-3 text-xs font-semibold text-slate-700">
                Minutes per level
                <input
                  aria-label="Minutes per RPG level"
                  type="number"
                  min="1"
                  max="1440"
                  value={rpgMinutesPerLevel}
                  onChange={(event) =>
                    onRpgMinutesPerLevelChange(
                      Math.max(
                        1,
                        Math.min(1440, Number(event.target.value) || 1),
                      ),
                    )
                  }
                  className="h-9 w-20 rounded-md border px-2 text-right tabular-nums"
                />
              </label>
              {historyError ? (
                <p
                  role="status"
                  className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
                >
                  RPG history is temporarily unavailable. Live ratios still
                  work.
                </p>
              ) : (
                <RpgView levels={rpgLevels} />
              )}
            </div>
          ) : (
            <>
              {model.totalSeconds <= 0 && (
                <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-600">
                  The selected tags have no {metric} time yet.
                </p>
              )}
              <RatioBars segments={model.segments} />
              <p className="text-center text-[11px] text-slate-500">
                {model.matchedActivityCount} matching{" "}
                {model.matchedActivityCount === 1 ? "activity" : "activities"} ·
                multi-tag time split evenly
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
