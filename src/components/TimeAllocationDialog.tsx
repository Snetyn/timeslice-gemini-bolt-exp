import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateAllocation,
  type AllocationActivity,
  type AllocationPreview,
  type AllocationSource,
} from "../domain/timeAllocation";

const format = (value: number) => {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export function TimeAllocationDialog({
  open,
  title,
  activities,
  vaultSeconds,
  sessionRevision,
  sourceId,
  targetId,
  operation = "transfer",
  minimumDonorSeconds = 0,
  initialSeconds,
  fundingChoice,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  activities: AllocationActivity[];
  vaultSeconds: number;
  sessionRevision: number;
  sourceId: AllocationSource;
  targetId: string | "vault";
  operation?: "transfer" | "extra";
  minimumDonorSeconds?: number;
  initialSeconds?: number;
  fundingChoice?: {
    value: "vault" | "otherActivities";
    onChange: (value: "vault" | "otherActivities") => void;
    remember: boolean;
    onRememberChange: (value: boolean) => void;
  };
  onClose: () => void;
  onConfirm: (preview: AllocationPreview) => boolean | Promise<boolean>;
}) {
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [allowProtectedManual, setAllowProtectedManual] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const requestedSeconds = Math.max(0, minutes * 60 + seconds);
  const preview = useMemo(
    () => calculateAllocation({ operation, activities, vaultSeconds, sessionRevision, requestedSeconds, sourceId, targetId, minimumDonorSeconds, allowProtectedManual }),
    [activities, allowProtectedManual, minimumDonorSeconds, operation, requestedSeconds, sessionRevision, sourceId, targetId, vaultSeconds],
  );
  useEffect(() => {
    if (!open) return;
    if (initialSeconds !== undefined) {
      const initial = Math.max(0, Math.floor(initialSeconds));
      setMinutes(Math.floor(initial / 60));
      setSeconds(initial % 60);
    }
    cancelRef.current?.focus();
    const viewport = window.visualViewport;
    const update = () => setViewportHeight(viewport?.height || window.innerHeight);
    const keydown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    update();
    viewport?.addEventListener("resize", update);
    window.addEventListener("keydown", keydown);
    return () => { viewport?.removeEventListener("resize", update); window.removeEventListener("keydown", keydown); };
  }, [initialSeconds, onClose, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="allocation-title">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" style={{ maxHeight: viewportHeight ? `${viewportHeight}px` : "100dvh" }}>
        <header className="flex items-center justify-between border-b px-4 py-3"><h2 id="allocation-title" className="text-lg font-bold">{title}</h2><button onClick={onClose} className="min-h-11 min-w-11 rounded-lg text-xl" aria-label="Close">×</button></header>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {fundingChoice && <div className="mb-4"><div className="mb-1 text-sm font-medium">Fund this action from</div><div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={fundingChoice.value === "vault"} onClick={() => fundingChoice.onChange("vault")} className={`min-h-11 rounded-lg border px-2 text-sm font-semibold ${fundingChoice.value === "vault" ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-200"}`}>Time Vault</button><button type="button" aria-pressed={fundingChoice.value === "otherActivities"} onClick={() => fundingChoice.onChange("otherActivities")} className={`min-h-11 rounded-lg border px-2 text-sm font-semibold ${fundingChoice.value === "otherActivities" ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-200"}`}>Other activities</button></div><label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={fundingChoice.remember} onChange={(event) => fundingChoice.onRememberChange(event.target.checked)} />Remember this choice</label></div>}
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Minutes<input inputMode="numeric" type="number" min="0" value={minutes} onChange={(event) => setMinutes(Math.max(0, Number(event.target.value) || 0))} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label><label className="text-sm font-medium">Seconds<input inputMode="numeric" type="number" min="0" max="59" value={seconds} onChange={(event) => setSeconds(Math.max(0, Math.min(59, Number(event.target.value) || 0)))} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label></div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3" aria-live="polite"><div className="mb-2 flex justify-between text-sm"><span>Requested</span><strong>{format(preview.requestedSeconds)}</strong></div>{preview.changes.map((change) => <div key={change.id} className="flex min-h-9 items-center justify-between gap-2 text-sm"><span className="truncate">{change.name}{change.protected ? " · protected" : ""}</span><span className="font-mono">{format(change.beforeSeconds)} → {format(change.afterSeconds)}</span></div>)}{preview.vaultBeforeSeconds !== preview.vaultAfterSeconds && <div className="flex min-h-9 items-center justify-between text-sm"><span>Time Vault</span><span className="font-mono">{format(preview.vaultBeforeSeconds)} → {format(preview.vaultAfterSeconds)}</span></div>}<div className="mt-2 flex justify-between border-t pt-2 text-sm"><span>Transferred</span><strong>{format(preview.appliedSeconds)}</strong></div>{preview.unfundedSeconds > 0 && <div className="mt-1 flex justify-between text-sm text-amber-700"><span>Unfunded</span><strong>{format(preview.unfundedSeconds)}</strong></div>}{preview.error && <p className="mt-2 text-sm text-red-700">{preview.error}</p>}</div>
          {preview.protectedOverrideRequired && <label className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm"><input type="checkbox" checked={allowProtectedManual} onChange={(event) => setAllowProtectedManual(event.target.checked)} /><span>I explicitly allow this Priority & protected activity to donate.</span></label>}
        </div>
        <footer className="sticky bottom-0 flex gap-2 border-t bg-white p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]"><button ref={cancelRef} onClick={onClose} className="min-h-11 flex-1 rounded-lg border font-semibold">Cancel</button><button disabled={!preview.valid} onClick={async () => { if (await onConfirm(preview)) onClose(); }} className="min-h-11 flex-1 rounded-lg bg-slate-950 font-semibold text-white disabled:opacity-40">Confirm</button></footer>
      </div>
    </div>
  );
}
