import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listTaskOccurrences,
  scheduleTaskOccurrence,
  subscribeTaskPlanning,
} from "../data/taskPlanningRepository";
import {
  localDateKey,
  type TaskOccurrenceRecord,
} from "../domain/taskPlanning";

type PickerTab = "today" | "inbox" | "lists";

export function SessionTaskPicker({
  disabled,
  selectedOccurrenceIds,
  onSelect,
}: {
  disabled?: boolean;
  selectedOccurrenceIds: string[];
  onSelect: (occurrence: TaskOccurrenceRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>("today");
  const [items, setItems] = useState<TaskOccurrenceRecord[]>([]);
  const [search, setSearch] = useState("");
  const refresh = useCallback(
    async () =>
      setItems(await listTaskOccurrences({ includeCompleted: false })),
    [],
  );
  useEffect(() => {
    if (!open) return;
    void refresh();
    return subscribeTaskPlanning(() => void refresh());
  }, [open, refresh]);
  const today = localDateKey();
  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (
          selectedOccurrenceIds.includes(item.id) ||
          item.status === "completed" ||
          item.status === "missed"
        )
          return false;
        if (
          !item.title
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase())
        )
          return false;
        if (tab === "today") return item.localDate === today;
        if (tab === "inbox") return item.status === "inbox";
        return Boolean(item.folderId);
      }),
    [items, search, selectedOccurrenceIds, tab, today],
  );

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="min-h-11 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-800 disabled:opacity-50"
      >
        Add from Tasks
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end bg-black/45 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-task-picker-title"
        >
          <div className="flex max-h-[88dvh] w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:rounded-2xl">
            <header className="flex min-h-14 items-center justify-between border-b px-3">
              <div>
                <h2 id="session-task-picker-title" className="font-bold">
                  Add shared task
                </h2>
                <p className="text-xs text-slate-500">
                  Daily and Session will record the same occurrence.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="min-h-11 min-w-11 rounded-lg border text-xl"
                aria-label="Close task picker"
              >
                ×
              </button>
            </header>
            <div className="grid grid-cols-3 gap-1 p-2">
              {(["today", "inbox", "lists"] as PickerTab[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`min-h-11 rounded-lg text-sm font-semibold capitalize ${tab === value ? "bg-slate-950 text-white" : "border"}`}
                >
                  {value}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks"
              className="mx-2 min-h-11 rounded-lg border px-3"
            />
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {visible.length === 0 && (
                <p className="p-5 text-center text-sm text-slate-500">
                  No eligible tasks in this section.
                </p>
              )}
              {visible.map((item) => (
                <button
                  key={item.id}
                  onClick={async () => {
                    const selected =
                      item.status === "inbox"
                        ? await scheduleTaskOccurrence(item.id, today)
                        : item;
                    onSelect(selected);
                    setOpen(false);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate">{item.title}</strong>
                    <span className="text-xs text-slate-500">
                      {Math.ceil(
                        Math.max(
                          0,
                          item.plannedDurationSeconds -
                            item.actualFocusedSeconds,
                        ) / 60,
                      )}{" "}
                      min remaining
                    </span>
                  </span>
                  <span className="text-indigo-700">Add</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
