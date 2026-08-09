import { useCallback, useEffect, useMemo, useState } from "react";
import { updateActivityDefinition } from "../data/activityCatalogRepository";
import {
  completeTaskOccurrence,
  ensureRecurringOccurrences,
  getOrCreateDailyPlan,
  getTaskPlannerSettings,
  listTaskOccurrences,
  refreshOccurrenceActual,
  saveDailyPlan,
  saveTaskPlannerSettings,
  scheduleTaskOccurrence,
  subscribeTaskPlanning,
  updateTaskOccurrence,
} from "../data/taskPlanningRepository";
import { timeSliceDb } from "../data/timesliceDb";
import {
  formatClockMinutes,
  localDateKey,
  parseClockMinutes,
  planCapacity,
  suggestTaskPlacements,
  type DailyPlanRecord,
  type TaskOccurrenceRecord,
  type TaskPlannerSettings,
} from "../domain/taskPlanning";

const formatDuration = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export function DailyPlanner({
  onStart,
  onComplete,
  onUseLegacy,
  onOnboarded,
}: {
  onStart: (occurrence: TaskOccurrenceRecord) => void;
  onComplete: (occurrence: TaskOccurrenceRecord) => void;
  onUseLegacy: () => void;
  onOnboarded: () => void;
}) {
  const today = localDateKey();
  const [settings, setSettings] = useState<TaskPlannerSettings | null>(null);
  const [plan, setPlan] = useState<DailyPlanRecord | null>(null);
  const [occurrences, setOccurrences] = useState<TaskOccurrenceRecord[]>([]);
  const [inbox, setInbox] = useState<TaskOccurrenceRecord[]>([]);
  const [windowStart, setWindowStart] = useState("08:00");
  const [windowEnd, setWindowEnd] = useState("22:00");
  const [capacityMinutes, setCapacityMinutes] = useState("");
  const [error, setError] = useState("");
  const [dueOccurrence, setDueOccurrence] =
    useState<TaskOccurrenceRecord | null>(null);

  const refresh = useCallback(async () => {
    try {
      await ensureRecurringOccurrences(today);
      const [nextSettings, nextPlan, all] = await Promise.all([
        getTaskPlannerSettings(),
        getOrCreateDailyPlan(today),
        listTaskOccurrences({ includeCompleted: true }),
      ]);
      const dayItems = await Promise.all(
        all
          .filter((item) => item.localDate === today)
          .map(async (item) =>
            refreshOccurrenceActual(item.id).catch(() => item),
          ),
      );
      setSettings(nextSettings);
      setPlan(nextPlan);
      setWindowStart(formatClockMinutes(nextPlan.windowStartMinutes));
      setWindowEnd(formatClockMinutes(nextPlan.windowEndMinutes));
      setCapacityMinutes(
        nextPlan.capacityOverrideSeconds === null
          ? ""
          : String(Math.round(nextPlan.capacityOverrideSeconds / 60)),
      );
      setOccurrences(dayItems);
      setInbox(all.filter((item) => item.status === "inbox"));
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Daily plan could not be loaded.",
      );
    }
  }, [today]);

  useEffect(() => {
    void refresh();
    return subscribeTaskPlanning(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    if (!occurrences.some((item) => item.status === "active")) return;
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [occurrences, refresh]);

  const placement = useMemo(
    () =>
      plan
        ? suggestTaskPlacements(plan, occurrences)
        : { occurrences, conflicts: [] },
    [occurrences, plan],
  );
  const capacity = useMemo(
    () => (plan ? planCapacity(plan, occurrences) : null),
    [occurrences, plan],
  );

  useEffect(() => {
    if (!plan?.confirmedAtMs) return;
    const sample = () => {
      const now = new Date();
      const minute = now.getHours() * 60 + now.getMinutes();
      const due = occurrences.find(
        (item) =>
          item.status === "planned" &&
          item.schedulingMode === "exact" &&
          item.exactStartMinutes !== null &&
          item.exactStartMinutes <= minute &&
          item.exactStartMinutes > minute - 2,
      );
      if (due) setDueOccurrence(due);
    };
    sample();
    const id = window.setInterval(sample, 30_000);
    return () => window.clearInterval(id);
  }, [occurrences, plan?.confirmedAtMs]);

  if (!settings || !plan)
    return (
      <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
        Loading Daily planner…
      </div>
    );

  if (!settings.onboarded) {
    return (
      <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-700">
            New shared planner
          </div>
          <h2 className="text-xl font-bold">Set your normal usable day</h2>
          <p className="mt-1 text-sm text-slate-600">
            08:00–22:00 is only a suggestion. Nothing is saved until you enable
            the planner.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">
            Start
            <input
              type="time"
              value={windowStart}
              onChange={(event) => setWindowStart(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"
            />
          </label>
          <label className="text-sm font-semibold">
            End
            <input
              type="time"
              value={windowEnd}
              onChange={(event) => setWindowEnd(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"
            />
          </label>
        </div>
        <button
          onClick={async () => {
            const start = parseClockMinutes(windowStart, 480);
            const end = parseClockMinutes(windowEnd, 1320);
            if (end <= start) {
              setError("End must be after start.");
              return;
            }
            await saveTaskPlannerSettings({
              version: 1,
              onboarded: true,
              normalWindowStartMinutes: start,
              normalWindowEndMinutes: end,
            });
            const saved = await saveDailyPlan({
              ...plan,
              windowStartMinutes: start,
              windowEndMinutes: end,
            });
            setPlan(saved);
            onOnboarded();
            await refresh();
          }}
          className="min-h-11 w-full rounded-lg bg-indigo-600 font-semibold text-white"
        >
          Enable shared Daily planner
        </button>
        <button
          onClick={onUseLegacy}
          className="min-h-11 w-full rounded-lg border bg-white font-semibold"
        >
          Keep using legacy Daily
        </button>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  const savePlanDraft = async (confirm = false) => {
    const start = parseClockMinutes(windowStart, plan.windowStartMinutes);
    const end = parseClockMinutes(windowEnd, plan.windowEndMinutes);
    if (end <= start) {
      setError("The usable day must end after it starts.");
      return;
    }
    const next = {
      ...plan,
      windowStartMinutes: start,
      windowEndMinutes: end,
      capacityOverrideSeconds: capacityMinutes.trim()
        ? Math.max(0, Number(capacityMinutes) || 0) * 60
        : null,
    };
    const nextCapacity = planCapacity(next, occurrences);
    const nextPlacement = suggestTaskPlacements(next, occurrences);
    if (
      confirm &&
      (nextCapacity.shortfallSeconds > 0 || nextPlacement.conflicts.length > 0)
    ) {
      setError(
        "Resolve the capacity shortfall and placement conflicts before confirming.",
      );
      return;
    }
    const saved = await saveDailyPlan(next, confirm);
    setPlan(saved);
    setError("");
  };

  return (
    <div className="space-y-3" data-testid="tasks-daily-planner">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Today</h2>
          <p className="text-xs text-slate-500">
            One occurrence shared by Daily and Session
          </p>
        </div>
        <button
          onClick={onUseLegacy}
          className="min-h-11 rounded-lg border px-3 text-xs font-semibold"
        >
          Legacy Daily
        </button>
      </div>
      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}
      {dueOccurrence && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-3"
          role="alertdialog"
          aria-label="Fixed task is due"
        >
          <strong>{dueOccurrence.title} is due now.</strong>
          <p className="text-sm text-slate-600">
            The current timer will never be interrupted automatically.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onStart(dueOccurrence);
                setDueOccurrence(null);
              }}
              className="min-h-11 rounded-lg bg-amber-500 font-semibold"
            >
              Switch
            </button>
            <button
              onClick={async () => {
                await updateTaskOccurrence(dueOccurrence.id, {
                  exactStartMinutes: Math.min(
                    1439,
                    (dueOccurrence.exactStartMinutes || 0) + 10,
                  ),
                });
                setDueOccurrence(null);
                await refresh();
              }}
              className="min-h-11 rounded-lg border bg-white font-semibold"
            >
              Delay 10m
            </button>
          </div>
        </div>
      )}

      <section className="rounded-xl border bg-white p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold">
            Usable start
            <input
              type="time"
              value={windowStart}
              onChange={(event) => setWindowStart(event.target.value)}
              onBlur={() => void savePlanDraft()}
              className="mt-1 min-h-11 w-full rounded-lg border px-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold">
            Usable end
            <input
              type="time"
              value={windowEnd}
              onChange={(event) => setWindowEnd(event.target.value)}
              onBlur={() => void savePlanDraft()}
              className="mt-1 min-h-11 w-full rounded-lg border px-2 text-sm"
            />
          </label>
        </div>
        <label className="mt-2 block text-xs font-semibold">
          Optional capacity override (minutes)
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={capacityMinutes}
            onChange={(event) => setCapacityMinutes(event.target.value)}
            onBlur={() => void savePlanDraft()}
            placeholder="Use full window"
            className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        {capacity && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <Metric
              label="Planned"
              value={formatDuration(capacity.plannedSeconds)}
            />
            <Metric
              label="Available"
              value={formatDuration(capacity.availableSeconds)}
            />
            <Metric
              label={capacity.shortfallSeconds ? "Shortfall" : "Unallocated"}
              value={formatDuration(
                capacity.shortfallSeconds || capacity.freeSeconds,
              )}
              danger={capacity.shortfallSeconds > 0}
            />
          </div>
        )}
        {capacity && capacity.shortfallSeconds > 0 && (
          <p className="mt-2 text-xs text-amber-800">
            Adaptive tasks can be reduced by up to{" "}
            {formatDuration(capacity.reducibleSeconds)}. Choose the reductions
            below; TimeSlice does not alter confirmed estimates automatically.
          </p>
        )}
      </section>

      {inbox.length > 0 && (
        <details className="rounded-xl border bg-white p-3">
          <summary className="min-h-11 cursor-pointer font-bold">
            Add from Inbox ({inbox.length})
          </summary>
          <div className="space-y-2">
            {inbox.map((item) => (
              <button
                key={item.id}
                onClick={async () => {
                  await scheduleTaskOccurrence(item.id, today);
                  await refresh();
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: item.color }}
                />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="text-xs">+ Today</span>
              </button>
            ))}
          </div>
        </details>
      )}

      <section className="space-y-2">
        {placement.conflicts.map((conflict) => (
          <div
            key={`${conflict.occurrenceId}:${conflict.kind}`}
            className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800"
          >
            {conflict.message}
          </div>
        ))}
        {placement.occurrences.length === 0 && (
          <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
            Today is empty. Capture tasks in the Tasks Inbox, then add them
            here.
          </div>
        )}
        {placement.occurrences.map((item) => (
          <article
            key={item.id}
            className={`rounded-xl border bg-white p-3 ${item.status === "completed" ? "opacity-55" : ""}`}
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 h-3 w-3 rounded-full"
                style={{ background: item.color }}
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-xs text-slate-500">
                  {item.schedulingMode === "flexible"
                    ? "Flexible"
                    : item.placementStartMinutes === null
                      ? "Unplaced"
                      : formatClockMinutes(item.placementStartMinutes)}{" "}
                  · {formatDuration(item.actualFocusedSeconds)} recorded
                </p>
              </div>
              <span className="text-sm font-bold">
                {formatDuration(item.plannedDurationSeconds)}
              </span>
            </div>
            {item.schedulingMode === "exact" && (
              <label className="mt-2 block text-xs font-semibold">
                Fixed start
                <input
                  type="time"
                  value={formatClockMinutes(
                    item.exactStartMinutes ?? plan.windowStartMinutes,
                  )}
                  onChange={async (event) => {
                    const start = parseClockMinutes(event.target.value);
                    await updateTaskOccurrence(item.id, {
                      exactStartMinutes: start,
                      placementStartMinutes: start,
                    });
                    await refresh();
                  }}
                  className="mt-1 min-h-11 w-full rounded-lg border px-2"
                />
              </label>
            )}
            {item.schedulingMode === "window" &&
              item.windowStartMinutes !== null &&
              item.windowEndMinutes !== null && (
                <label className="mt-2 block text-xs font-semibold">
                  Position in window:{" "}
                  {formatClockMinutes(
                    item.placementStartMinutes ?? item.windowStartMinutes,
                  )}
                  <input
                    aria-label={`${item.title} placement`}
                    type="range"
                    min={item.windowStartMinutes}
                    max={Math.max(
                      item.windowStartMinutes,
                      item.windowEndMinutes -
                        Math.ceil(item.plannedDurationSeconds / 60),
                    )}
                    step="5"
                    value={
                      item.placementStartMinutes ?? item.windowStartMinutes
                    }
                    onChange={async (event) => {
                      await updateTaskOccurrence(item.id, {
                        placementStartMinutes: Number(event.target.value),
                      });
                      await refresh();
                    }}
                    className="min-h-11 w-full"
                  />
                </label>
              )}
            {item.durationMode === "adaptive" &&
              item.status !== "completed" && (
                <label className="mt-2 block text-xs">
                  Chosen estimate: {minutesLabel(item.plannedDurationSeconds)}
                  <input
                    aria-label={`${item.title} chosen duration`}
                    type="range"
                    min={Math.ceil(item.minimumDurationSeconds / 60)}
                    max={
                      Math.max(
                        Math.ceil(item.plannedDurationSeconds / 60),
                        Math.ceil(item.minimumDurationSeconds / 60),
                      ) + 120
                    }
                    value={Math.ceil(item.plannedDurationSeconds / 60)}
                    onChange={(event) =>
                      void updateTaskOccurrence(item.id, {
                        plannedDurationSeconds: Number(event.target.value) * 60,
                      }).then(refresh)
                    }
                    className="w-full"
                  />
                </label>
              )}
            {item.actualFocusedSeconds >= item.plannedDurationSeconds &&
              item.status !== "completed" && (
                <div className="mt-2 rounded-lg bg-indigo-50 p-2">
                  <p className="text-xs font-semibold">Estimate reached</p>
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    <button
                      onClick={async () => {
                        const done = await completeTaskOccurrence(item.id);
                        onComplete(done);
                        await refresh();
                      }}
                      className="min-h-11 rounded border bg-white text-xs font-semibold"
                    >
                      Done
                    </button>
                    <button
                      onClick={async () => {
                        await updateTaskOccurrence(item.id, {
                          status: "active",
                          plannedDurationSeconds:
                            item.actualFocusedSeconds + 15 * 60,
                        });
                        await refresh();
                      }}
                      className="min-h-11 rounded border bg-white text-xs font-semibold"
                    >
                      Continue overtime
                    </button>
                    <button
                      onClick={async () => {
                        const next = Math.max(
                          item.actualFocusedSeconds,
                          item.minimumDurationSeconds,
                        );
                        await updateTaskOccurrence(item.id, {
                          plannedDurationSeconds: next,
                          durationOverrideSeconds: next,
                        });
                        if (
                          item.activityDefinitionId &&
                          window.confirm(
                            "Use this estimate for future occurrences too?",
                          )
                        ) {
                          const definition =
                            await timeSliceDb.activityDefinitions.get(
                              item.activityDefinitionId,
                            );
                          if (definition)
                            await updateActivityDefinition(
                              definition.id,
                              { baselineDurationSeconds: next },
                              definition.revision,
                            );
                        }
                        await refresh();
                      }}
                      className="min-h-11 rounded border bg-white text-xs font-semibold"
                    >
                      Update estimate
                    </button>
                  </div>
                </div>
              )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {item.status !== "completed" ? (
                <>
                  <button
                    onClick={async () => {
                      const active = await updateTaskOccurrence(item.id, {
                        status: "active",
                      });
                      onStart(active);
                      await refresh();
                    }}
                    className="min-h-11 rounded-lg bg-slate-950 font-semibold text-white"
                  >
                    Start
                  </button>
                  <button
                    onClick={async () => {
                      const done = await completeTaskOccurrence(item.id);
                      onComplete(done);
                      await refresh();
                    }}
                    className="min-h-11 rounded-lg border font-semibold"
                  >
                    Done
                  </button>
                </>
              ) : (
                <button
                  onClick={async () => {
                    await updateTaskOccurrence(item.id, {
                      status: "planned",
                      completedAtMs: null,
                      completionSnapshot: null,
                    });
                    await refresh();
                  }}
                  className="col-span-2 min-h-11 rounded-lg border font-semibold"
                >
                  Reopen
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      <button
        disabled={
          !capacity ||
          capacity.shortfallSeconds > 0 ||
          placement.conflicts.length > 0
        }
        onClick={() => void savePlanDraft(true)}
        className="min-h-12 w-full rounded-xl bg-indigo-600 font-bold text-white disabled:opacity-40"
      >
        {plan.confirmedAtMs ? "Update confirmed plan" : "Confirm day plan"}
      </button>
    </div>
  );
}

const minutesLabel = (seconds: number) => `${Math.round(seconds / 60)} min`;
function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-2 ${danger ? "bg-red-50 text-red-800" : "bg-slate-50"}`}
    >
      <div className="text-slate-500">{label}</div>
      <strong>{value}</strong>
    </div>
  );
}
