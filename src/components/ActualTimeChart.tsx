import type { ActivityInsights } from "../domain/activityInsights";
import { readableDuration } from "../domain/activityInsights";

export function ActualTimeChart({ insights }: { insights: ActivityInsights }) {
  const areas = insights.classifiedAreas;
  if (areas.length < 3) {
    return (
      <div className="space-y-3" aria-label="Recorded time by life area">
        {areas.length === 0 && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Assign activities to at least three life areas to unlock the radar. Recorded time remains visible below.
          </p>
        )}
        {insights.areas.map((area) => (
          <div key={area.id || "unassigned"}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-800">
                {area.name}{area.archived ? " (archived)" : ""}
              </span>
              <span className="font-mono text-slate-600">{readableDuration(area.durationMs)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] motion-reduce:transition-none"
                style={{
                  width: `${Math.min(100, (area.durationMs / insights.scaleMaxMs) * 100)}%`,
                  backgroundColor: area.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const size = 260;
  const center = size / 2;
  const radius = 88;
  const points = areas.map((area, index) => {
    const angle = -Math.PI / 2 + (index / areas.length) * Math.PI * 2;
    const ratio = Math.min(1, area.durationMs / insights.scaleMaxMs);
    return `${center + Math.cos(angle) * radius * ratio},${center + Math.sin(angle) * radius * ratio}`;
  });
  return (
    <div>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto h-auto w-full max-w-[260px]"
        role="img"
        aria-label={`Actual recorded time radar. ${areas.map((area) => `${area.name}: ${readableDuration(area.durationMs)}`).join(", ")}`}
      >
        <circle cx={center} cy={center} r={radius} fill="#f8fafc" stroke="#cbd5e1" />
        <circle cx={center} cy={center} r={radius / 2} fill="none" stroke="#e2e8f0" />
        {areas.map((area, index) => {
          const angle = -Math.PI / 2 + (index / areas.length) * Math.PI * 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return <line key={area.id} x1={center} y1={center} x2={x} y2={y} stroke="#dbeafe" />;
        })}
        <polygon points={points.join(" ")} fill="rgba(79,70,229,.28)" stroke="#4f46e5" strokeWidth="3" />
      </svg>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {areas.map((area) => (
          <div key={area.id} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: area.color }} />
            <span className="truncate">{area.name}</span>
            <span className="ml-auto font-mono">{readableDuration(area.durationMs)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
