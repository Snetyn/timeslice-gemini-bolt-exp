import { useCallback, useEffect, useMemo, useState } from "react";
import {
  correctActivitySession,
  listActivitySessions,
  setActivitySessionDeleted,
} from "../data/activitySessionRepository";
import {
  activitySessionDurationMs,
  type ActivitySessionRecord,
} from "../domain/activitySession";

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}h ${minutes}m ${seconds}s`
    : `${minutes}m ${seconds}s`;
};

const toLocalInputValue = (timestamp: number) => {
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

type EditState = {
  id: string;
  activityName: string;
  startedAt: string;
  durationMinutes: string;
};

export function ActivityHistoryModal({
  onClose,
  readOnly = false,
}: {
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [sessions, setSessions] = useState<ActivitySessionRecord[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  const reload = useCallback(async () => {
    setSessions(await listActivitySessions({ includeDeleted: true }));
  }, []);

  useEffect(() => {
    void reload().catch((loadError) => setError(String(loadError)));
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
      void reload().catch((loadError) => setError(String(loadError)));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [reload]);

  const visible = useMemo(
    () => sessions.filter((session) => showDeleted || !session.deletedAtMs),
    [sessions, showDeleted],
  );

  const beginEdit = (session: ActivitySessionRecord) => {
    setError("");
    setEdit({
      id: session.id,
      activityName: session.activityName,
      startedAt: toLocalInputValue(session.startedAtMs),
      durationMinutes: String(
        Math.max(0.01, Math.round((session.durationMs / 60_000) * 100) / 100),
      ),
    });
  };

  const saveEdit = async () => {
    if (!edit) return;
    const existing = sessions.find((session) => session.id === edit.id);
    if (!existing) return;
    const startedAtMs = new Date(edit.startedAt).getTime();
    const durationMs = Number(edit.durationMinutes) * 60_000;
    try {
      await correctActivitySession(
        existing.id,
        { activityName: edit.activityName, startedAtMs, durationMs },
        existing.revision,
      );
      setEdit(null);
      await reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    }
  };

  const setDeleted = async (
    session: ActivitySessionRecord,
    deleted: boolean,
  ) => {
    if (
      deleted &&
      !window.confirm(
        "Remove this activity record from history? You can restore it later.",
      )
    ) {
      return;
    }
    try {
      await setActivitySessionDeleted(session.id, deleted, session.revision);
      await reload();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : String(deleteError),
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-history-title"
    >
      <section
        className="max-h-[100dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recorded activity
            </p>
            <h2
              id="activity-history-title"
              className="text-xl font-bold text-slate-900"
            >
              Activity history
            </h2>
          </div>
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-md text-xl text-slate-600 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Close activity history"
          >
            ×
          </button>
        </header>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">
            {visible.length} {visible.length === 1 ? "record" : "records"}
          </span>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(event) => setShowDeleted(event.target.checked)}
            />
            Show removed
          </label>
        </div>

        {readOnly && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            This window is view-only. Take control before editing history.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        <div className="mt-3 space-y-2">
          {visible.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              Completed activity intervals will appear here.
            </p>
          )}
          {visible.map((session) => {
            const isEditing = edit?.id === session.id;
            const isDeleted = session.deletedAtMs !== undefined;
            return (
              <article
                key={session.id}
                className={`rounded-lg border p-3 ${isDeleted ? "border-slate-200 bg-slate-100 opacity-75" : "border-slate-200 bg-white"}`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Activity
                      <input
                        className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
                        value={edit.activityName}
                        onChange={(event) =>
                          setEdit({ ...edit, activityName: event.target.value })
                        }
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Started
                        <input
                          type="datetime-local"
                          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
                          value={edit.startedAt}
                          onChange={(event) =>
                            setEdit({ ...edit, startedAt: event.target.value })
                          }
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Duration (minutes)
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
                          value={edit.durationMinutes}
                          onChange={(event) =>
                            setEdit({
                              ...edit,
                              durationMinutes: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
                        onClick={() => setEdit(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="min-h-11 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white"
                        onClick={() => void saveEdit()}
                      >
                        Save correction
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          <span
                            className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                session.activityColor || "#64748b",
                            }}
                          />
                          {session.activityName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(session.startedAtMs).toLocaleString()} ·{" "}
                          {session.source}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <strong className="text-sm text-slate-900">
                          {formatDuration(
                            activitySessionDurationMs(session, nowMs),
                          )}
                        </strong>
                        {session.status === "running" && (
                          <span className="mt-1 block text-xs font-semibold text-emerald-700">
                            Running
                          </span>
                        )}
                      </div>
                    </div>
                    {!readOnly && session.status !== "running" && (
                      <div className="mt-3 flex justify-end gap-2">
                        {!isDeleted && (
                          <button
                            type="button"
                            className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
                            onClick={() => beginEdit(session)}
                          >
                            Correct
                          </button>
                        )}
                        <button
                          type="button"
                          className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
                          onClick={() => void setDeleted(session, !isDeleted)}
                        >
                          {isDeleted ? "Restore" : "Remove"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
