import type { CSSProperties } from "react";
import type { TimerDisplayVariant } from "../lib/appearance";

export type TimerDisplaySegment = {
  id: string;
  label: string;
  color: string;
  value: number;
};

export type TimerVisualModel = {
  title: string;
  timeText?: string;
  subtitle?: string;
  status?: "running" | "paused" | "ready" | "break" | "complete";
  progress: number;
  accent?: string;
  segments?: TimerDisplaySegment[];
  metrics?: Array<{ label: string; value: string }>;
};

type TimerDisplayProps = {
  variant: TimerDisplayVariant;
  model: TimerVisualModel;
  className?: string;
};

export const clampProgress = (progress: number) =>
  Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;

export const normalizeTimerSegments = (
  segments: TimerDisplaySegment[] = [],
) => {
  const safe = segments
    .map((segment) => ({ ...segment, value: Math.max(0, segment.value || 0) }))
    .filter((segment) => segment.value > 0);
  const total = safe.reduce((sum, segment) => sum + segment.value, 0);
  if (!total) return [];
  return safe.map((segment) => ({
    ...segment,
    percentage: (segment.value / total) * 100,
  }));
};

export function TimerDisplay({
  variant,
  model,
  className = "",
}: TimerDisplayProps) {
  const progress = clampProgress(model.progress);
  const accent = model.accent || "var(--ts-accent)";
  const segments = normalizeTimerSegments(model.segments);
  const ringStyle = {
    "--timer-progress": `${progress * 3.6}deg`,
    "--timer-accent": accent,
  } as CSSProperties;

  return (
    <section
      className={`ts-timer-display ts-timer-variant-${variant} ${className}`}
      aria-label={`${model.title} timer`}
    >
      <div className="ts-timer-visual">
        {variant === "ring" && (
          <div
            className="ts-timer-ring"
            style={ringStyle}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label={`${model.title} progress`}
          >
            <div className="ts-timer-ring-inner">
              <TimerCopy model={model} progress={progress} />
            </div>
          </div>
        )}

        {variant !== "ring" && (
          <div className="ts-timer-copy-wrap">
            <TimerCopy model={model} progress={progress} />
            {variant === "bar" && (
              <div
                className="ts-timer-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                aria-label={`${model.title} progress`}
              >
                <span
                  className="ts-timer-progress-fill"
                  style={{ width: `${progress}%`, backgroundColor: accent }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {segments.length > 0 && variant !== "minimal" && (
        <div className="ts-segment-summary" aria-label="Time allocation">
          <div className="ts-segment-track">
            {segments.map((segment) => (
              <span
                key={segment.id}
                style={{
                  width: `${segment.percentage}%`,
                  backgroundColor: segment.color,
                }}
                title={`${segment.label}: ${Math.round(segment.percentage)}%`}
              />
            ))}
          </div>
          <div className="ts-segment-legend">
            {segments.slice(0, 5).map((segment) => (
              <span key={segment.id}>
                <i style={{ backgroundColor: segment.color }} />
                {segment.label}
              </span>
            ))}
            {segments.length > 5 && <span>+{segments.length - 5} more</span>}
          </div>
        </div>
      )}

      {model.metrics && model.metrics.length > 0 && (
        <dl className="ts-timer-metrics">
          {model.metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function TimerCopy({
  model,
  progress,
}: {
  model: TimerVisualModel;
  progress: number;
}) {
  return (
    <div className="ts-timer-copy">
      <div className="ts-timer-title-row">
        <span className="ts-timer-title">{model.title}</span>
        {model.status && (
          <span className={`ts-status ts-status-${model.status}`}>
            {model.status}
          </span>
        )}
      </div>
      {model.timeText && (
        <strong className="ts-timer-time">{model.timeText}</strong>
      )}
      {model.subtitle && (
        <span className="ts-timer-subtitle">{model.subtitle}</span>
      )}
      <span className="ts-timer-percent">{Math.round(progress)}%</span>
    </div>
  );
}
