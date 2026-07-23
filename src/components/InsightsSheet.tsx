import { useEffect, useRef, useState } from "react";
import { readableDuration, type InsightsPeriod } from "../domain/activityInsights";
import { useActivityInsights } from "../hooks/useActivityInsights";
import { ActualTimeChart } from "./ActualTimeChart";

export function InsightsSheet({
  open,
  onClose,
  onManage,
}: {
  open: boolean;
  onClose: () => void;
  onManage: () => void;
}) {
  const [period, setPeriod] = useState<InsightsPeriod>("today");
  const closeRef = useRef<HTMLButtonElement>(null);
  const { insights, error } = useActivityInsights(period, open);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-white" role="dialog" aria-modal="true" aria-labelledby="insights-title">
      <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col overflow-hidden">
        <header className="flex min-h-14 items-center justify-between border-b border-slate-200 px-3 pt-[env(safe-area-inset-top)]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Actual focused time</div>
            <h2 id="insights-title" className="text-xl font-bold text-slate-950">Insights</h2>
          </div>
          <button ref={closeRef} onClick={onClose} className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-xl" aria-label="Close Insights">×</button>
        </header>
        <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mb-3 grid grid-cols-3 rounded-xl bg-slate-100 p-1" aria-label="Insights period">
            {(["today", "week", "month"] as const).map((value) => (
              <button key={value} onClick={() => setPeriod(value)} aria-pressed={period === value} className={`min-h-11 rounded-lg px-3 text-sm font-semibold capitalize ${period === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}>{value}</button>
            ))}
          </div>
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Insights could not be loaded.</p> : (
            <>
              <section className="mb-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-indigo-50 p-3"><div className="text-xs text-indigo-700">Recorded</div><div className="text-xl font-bold text-indigo-950">{readableDuration(insights.totalDurationMs)}</div></div>
                <div className="rounded-xl bg-blue-50 p-3"><div className="text-xs text-blue-700">Focus intervals</div><div className="text-xl font-bold text-blue-950">{insights.intervalCount}</div></div>
              </section>
              <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900"><strong>{insights.momentumTotal} intentional {insights.momentumTotal === 1 ? "decision" : "decisions"}</strong> in this period. Momentum marks choices only; recorded time stays unchanged.</div>
              {insights.running && <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Recording · {insights.running.lifeAreaName || "Unassigned"} · {insights.running.activityName}</div>}
              <section className="mb-3 rounded-2xl border border-slate-200 p-3"><h3 className="mb-3 font-bold text-slate-900">Life areas</h3><ActualTimeChart insights={insights} /></section>
              <section className="rounded-2xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between"><h3 className="font-bold text-slate-900">Recent recordings</h3><button onClick={onManage} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-indigo-700">Areas & activities</button></div>
                <div className="divide-y divide-slate-100">
                  {insights.recent.length === 0 && <p className="py-4 text-sm text-slate-500">No focused time recorded in this period.</p>}
                  {insights.recent.map((record) => <div key={record.id} className="flex items-center gap-3 py-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: record.lifeAreaColor || record.activityColor || "#94a3b8" }} /><div className="min-w-0 flex-1"><div className="truncate font-medium">{record.activityName}</div><div className="text-xs text-slate-500">{record.lifeAreaName || "Unassigned"}</div></div><span className="font-mono text-slate-600">{readableDuration(record.status === "running" ? Math.max(0, Date.now() - record.startedAtMs) : record.durationMs)}</span></div>)}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
