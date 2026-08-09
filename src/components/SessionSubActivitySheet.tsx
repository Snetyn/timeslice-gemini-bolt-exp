import { useEffect, useMemo, useRef, useState } from "react";
import type { SubActivityFundingPreview } from "../domain/sessionSubActivities";

const formatDuration = (value: number) => {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export function SessionSubActivitySheet({
  open,
  parentName,
  initialName = "",
  action = "create",
  preview,
  donorNames,
  existingNames,
  onPreview,
  onConfirm,
  onClose,
}: {
  open: boolean;
  parentName: string;
  initialName?: string;
  action?: "create" | "increase";
  preview: SubActivityFundingPreview;
  donorNames: Record<string, string>;
  existingNames: string[];
  onPreview: (seconds: number) => void;
  onConfirm: (name: string, seconds: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const requested = useMemo(
    () =>
      Math.max(0, Number.parseInt(minutes || "0") || 0) * 60 +
      Math.max(0, Math.min(59, Number.parseInt(seconds || "0") || 0)),
    [minutes, seconds],
  );
  const duplicate = existingNames.some(
    (existing) =>
      existing.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() &&
      Boolean(name.trim()),
  );

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setMinutes("");
    setSeconds("");
    onPreview(0);
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
    // Reset only when a new sheet opens. Timer rerenders must not dismiss the
    // Android keyboard or overwrite an in-progress numeric draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName]);

  useEffect(() => {
    if (open) onPreview(requested);
  }, [onPreview, open, requested]);

  if (!open) return null;
  const valid = Boolean(name.trim()) && !duplicate && preview.valid;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-activity-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {parentName}
            </p>
            <h2
              id="sub-activity-title"
              className="text-lg font-bold text-slate-900"
            >
              {action === "increase"
                ? "Add time to sub-activity"
                : "Add sub-activity"}
            </h2>
          </div>
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-lg text-xl text-slate-600 hover:bg-slate-100"
            aria-label="Close sub-activity sheet"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <label className="mt-3 block text-sm font-medium text-slate-700">
          Name
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            placeholder="Kitchen"
            autoComplete="off"
            readOnly={action === "increase"}
          />
        </label>
        {duplicate && (
          <p className="mt-1 text-xs font-medium text-rose-700">
            A sub-activity with this name already exists.
          </p>
        )}

        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-slate-700">Time</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              Minutes
              <input
                inputMode="numeric"
                value={minutes}
                onChange={(event) =>
                  setMinutes(event.target.value.replace(/\D/g, ""))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                aria-label="Sub-activity minutes"
              />
            </label>
            <label className="text-xs text-slate-500">
              Seconds
              <input
                inputMode="numeric"
                value={seconds}
                onChange={(event) =>
                  setSeconds(event.target.value.replace(/\D/g, "").slice(0, 2))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                aria-label="Sub-activity seconds"
              />
            </label>
          </div>
        </fieldset>

        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-600">Available from {parentName}</span>
            <strong>{formatDuration(preview.maximumSeconds)}</strong>
          </div>
          {requested > preview.maximumSeconds && (
            <p className="mt-1 text-xs font-medium text-rose-700">
              Enter at most {formatDuration(preview.maximumSeconds)}.
            </p>
          )}
          {Object.keys(preview.donatedSecondsById).length > 0 && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Parent time change
              </p>
              <ul className="mt-1 space-y-1">
                {Object.entries(preview.donatedSecondsById).map(
                  ([id, amount]) => (
                    <li key={id} className="flex justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate">
                        {donorNames[id] || "Activity"}
                      </span>
                      <span className="shrink-0">
                        −{formatDuration(amount)}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!valid}
          className="mt-4 min-h-11 w-full rounded-lg bg-indigo-700 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          onClick={() => onConfirm(name.trim(), requested)}
        >
          {action === "increase"
            ? `Add ${requested > 0 ? formatDuration(requested) : "time"}`
            : `Add ${requested > 0 ? formatDuration(requested) : "sub-activity"}`}
        </button>
      </div>
    </div>
  );
}
