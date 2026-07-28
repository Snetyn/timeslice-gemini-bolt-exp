import type {
  DailyTagWheelModel,
  DailyTagWheelMetric,
} from "../domain/dailyTagWheel";

const duration = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

function Wheel({
  model,
  metric,
}: {
  model: DailyTagWheelModel;
  metric: DailyTagWheelMetric;
}) {
  const radius = 46;
  const circumference = Math.PI * 2 * radius;
  let offset = 0;
  const label = `${model.title}, ${metric}. Total ${duration(model.totalSeconds)}. ${model.segments
    .map((segment) => `${segment.name}: ${duration(segment.seconds)}`)
    .join(", ")}`;
  return (
    <article className="min-w-[190px] flex-1 rounded-xl border border-slate-200 bg-white p-2.5">
      <h4 className="truncate text-center text-sm font-bold text-slate-800">
        {model.title}
      </h4>
      <svg
        viewBox="0 0 120 120"
        className="mx-auto h-[150px] w-[150px]"
        role="img"
        aria-label={label}
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="14"
        />
        {model.totalSeconds > 0 &&
          model.segments.map((segment) => {
            const length = segment.share * circumference;
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
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-currentOffset}
                transform="rotate(-90 60 60)"
                strokeLinecap="butt"
              />
            );
          })}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          className="fill-slate-500 text-[9px] font-semibold uppercase"
        >
          {metric}
        </text>
        <text
          x="60"
          y="70"
          textAnchor="middle"
          className="fill-slate-900 text-[12px] font-bold"
        >
          {duration(model.totalSeconds)}
        </text>
      </svg>
      <div
        className="max-h-28 space-y-1 overflow-y-auto"
        aria-label={`${model.title} legend`}
      >
        {model.segments.map((segment) => (
          <div key={segment.id} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="min-w-0 flex-1 truncate">{segment.name}</span>
            <span className="font-mono text-slate-600">
              {duration(segment.seconds)}
            </span>
          </div>
        ))}
        {model.segments.length === 0 && (
          <p className="text-center text-xs text-slate-500">
            No matching activities
          </p>
        )}
      </div>
    </article>
  );
}

export function DailyTagWheels({
  models,
  metric,
}: {
  models: DailyTagWheelModel[];
  metric: DailyTagWheelMetric;
}) {
  if (models.length === 0) return null;
  return (
    <section
      className="flex snap-x gap-2 overflow-x-auto pb-1"
      aria-label="Tag time wheels"
    >
      {models.map((model) => (
        <div key={model.id} className="snap-start">
          <Wheel model={model} metric={metric} />
        </div>
      ))}
    </section>
  );
}
