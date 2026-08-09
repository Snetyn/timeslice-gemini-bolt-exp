import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFolder,
  listActivityDefinitions,
  listFolders,
  setFolderArchived,
  updateActivityDefinition,
} from "../data/activityCatalogRepository";
import {
  createInboxTask,
  ensureRecurringOccurrences,
  getAdaptiveEstimate,
  listPlannerDefinitions,
  listTaskOccurrences,
  organizeTaskOccurrence,
  promoteOneOffTask,
  scheduleTaskOccurrence,
  subscribeTaskPlanning,
  updateTaskOccurrence,
} from "../data/taskPlanningRepository";
import {
  flattenFolderTree,
  type ActivityDefinitionRecord,
  type ActivityFolderRecord,
} from "../domain/activityCatalog";
import {
  buildCanonicalTags,
  normalizeAssignedTags,
  normalizeTagName,
  type CanonicalTag,
} from "../domain/tags";
import {
  formatClockMinutes,
  localDateKey,
  type TaskOccurrenceRecord,
} from "../domain/taskPlanning";
import { appStorage, flushAppStorage } from "../lib/storage";

type TasksHubTab =
  "inbox" | "today" | "upcoming" | "lists" | "tags" | "historical";

const tabs: Array<{ id: TasksHubTab; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "lists", label: "Lists" },
  { id: "tags", label: "Tags" },
  { id: "historical", label: "Historical" },
];

const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));

export function TasksHub({
  open,
  onClose,
  onOpenLegacy,
  onOpenCatalog,
}: {
  open: boolean;
  onClose: () => void;
  onOpenLegacy: () => void;
  onOpenCatalog: () => void;
}) {
  const [tab, setTab] = useState<TasksHubTab>("inbox");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [occurrences, setOccurrences] = useState<TaskOccurrenceRecord[]>([]);
  const [definitions, setDefinitions] = useState<ActivityDefinitionRecord[]>(
    [],
  );
  const [legacyDefinitions, setLegacyDefinitions] = useState<
    ActivityDefinitionRecord[]
  >([]);
  const [folders, setFolders] = useState<ActivityFolderRecord[]>([]);
  const [tags, setTags] = useState<CanonicalTag[]>([]);
  const [captureTags, setCaptureTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      await ensureRecurringOccurrences();
      const [nextOccurrences, nextDefinitions, allDefinitions, nextFolders] =
        await Promise.all([
          listTaskOccurrences({ includeCompleted: true }),
          listPlannerDefinitions(),
          listActivityDefinitions(true),
          listFolders(true),
        ]);
      setOccurrences(nextOccurrences);
      setDefinitions(nextDefinitions);
      setLegacyDefinitions(
        allDefinitions.filter((definition) => !definition.planningEnabled),
      );
      setFolders(nextFolders);
      const parse = (key: string, fallback: unknown) => {
        try {
          return JSON.parse(appStorage.getItem(key) || "") as unknown;
        } catch {
          return fallback;
        }
      };
      setTags(
        buildCanonicalTags({
          rpgTags: parse("timeSliceRPGTags", []),
          customTags: parse("timeSliceCustomTags", []),
        }),
      );
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Tasks could not be loaded.",
      );
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    return subscribeTaskPlanning(() => void refresh());
  }, [open, refresh]);

  const today = localDateKey();
  const shown = useMemo(() => {
    if (tab === "inbox")
      return occurrences.filter((item) => item.status === "inbox");
    if (tab === "today")
      return occurrences.filter(
        (item) => item.localDate === today && !["missed"].includes(item.status),
      );
    if (tab === "upcoming")
      return occurrences.filter(
        (item) =>
          item.localDate &&
          item.localDate > today &&
          item.status !== "completed",
      );
    if (tab === "historical")
      return occurrences.filter(
        (item) => item.status === "completed" || item.status === "missed",
      );
    return occurrences;
  }, [occurrences, tab, today]);
  const flatFolders = useMemo(
    () => flattenFolderTree(folders, true),
    [folders],
  );

  if (!open) return null;
  const capture = async (kind: "one-off" | "reusable") => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createInboxTask({
        title,
        kind,
        tagIds: captureTags,
        baselineDurationSeconds: Math.max(1, Number(duration) || 60) * 60,
      });
      setTitle("");
      setCaptureTags([]);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Task could not be created.",
      );
    } finally {
      setBusy(false);
    }
  };
  const createPlannerTag = async () => {
    const normalized = normalizeTagName(newTag);
    if (!normalized) return;
    let current: string[] = [];
    try {
      current = normalizeAssignedTags(
        JSON.parse(appStorage.getItem("timeSliceCustomTags") || "[]"),
      );
    } catch {
      current = [];
    }
    if (!current.some((value) => normalizeTagName(value) === normalized)) {
      appStorage.setItem(
        "timeSliceCustomTags",
        JSON.stringify([...current, normalized]),
      );
      await flushAppStorage();
    }
    setNewTag("");
    await refresh();
  };

  return (
    <div
      className="fixed inset-0 z-[86] bg-slate-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tasks-hub-title"
    >
      <div className="mx-auto flex h-[100dvh] max-w-4xl flex-col overflow-hidden">
        <header className="flex min-h-14 items-center justify-between border-b bg-white px-3 pt-[env(safe-area-inset-top)]">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">
              Shared planner
            </div>
            <h2 id="tasks-hub-title" className="text-xl font-bold">
              Tasks
            </h2>
          </div>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg border text-xl"
            aria-label="Close Tasks"
          >
            ×
          </button>
        </header>
        <nav
          className="flex gap-1 overflow-x-auto border-b bg-white px-2 py-2"
          aria-label="Task sections"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold ${tab === item.id ? "bg-slate-950 text-white" : "border bg-white"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <main className="flex-1 space-y-3 overflow-y-auto p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {error}
              <button onClick={() => void refresh()} className="ml-2 underline">
                Retry
              </button>
            </div>
          )}

          {tab === "inbox" && (
            <section className="rounded-xl border bg-white p-3">
              <h3 className="font-bold">Quick Inbox capture</h3>
              <p className="mb-2 text-xs text-slate-600">
                One-off stays only in this occurrence. Reusable also creates a
                future activity definition.
              </p>
              <input
                autoComplete="off"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs doing?"
                className="min-h-11 w-full rounded-lg border px-3"
              />
              <label className="mt-2 flex items-center gap-2 text-sm">
                <span>Estimate</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  className="min-h-11 w-24 rounded-lg border px-2"
                />
                <span>min</span>
              </label>
              {tags.length > 0 && (
                <fieldset className="mt-2">
                  <legend className="text-xs font-semibold text-slate-600">
                    Optional tags
                  </legend>
                  <div className="mt-1 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                    {tags.map((tag) => {
                      const selected = captureTags.includes(tag.storageValue);
                      return (
                        <button
                          type="button"
                          key={tag.key}
                          aria-pressed={selected}
                          onClick={() =>
                            setCaptureTags((current) =>
                              selected
                                ? current.filter(
                                    (value) => value !== tag.storageValue,
                                  )
                                : [...current, tag.storageValue],
                            )
                          }
                          className={`min-h-9 rounded-full border px-3 text-xs ${selected ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "bg-white"}`}
                        >
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-full"
                            style={{ background: tag.color }}
                          />
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  disabled={busy || !title.trim()}
                  onClick={() => void capture("one-off")}
                  className="min-h-11 rounded-lg border font-semibold disabled:opacity-50"
                >
                  One-off
                </button>
                <button
                  disabled={busy || !title.trim()}
                  onClick={() => void capture("reusable")}
                  className="min-h-11 rounded-lg bg-indigo-600 font-semibold text-white disabled:opacity-50"
                >
                  Reusable
                </button>
              </div>
            </section>
          )}

          {tab === "lists" && (
            <section className="rounded-xl border bg-white p-3">
              <h3 className="font-bold">Lists</h3>
              <p className="text-xs text-slate-600">
                The existing folder tree is shared with activities.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={newFolder}
                  onChange={(event) => setNewFolder(event.target.value)}
                  placeholder="New list"
                  className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"
                />
                <button
                  onClick={async () => {
                    if (!newFolder.trim()) return;
                    await createFolder({ name: newFolder });
                    setNewFolder("");
                    await refresh();
                  }}
                  className="min-h-11 rounded-lg border px-3 font-semibold"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {flatFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`rounded-lg bg-slate-50 px-3 py-2 ${folder.effectivelyArchived ? "opacity-45" : ""}`}
                    style={{ paddingLeft: `${12 + folder.depth * 18}px` }}
                  >
                    <span className="flex min-h-11 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {folder.name}
                      </span>
                      <button
                        onClick={async () => {
                          await setFolderArchived(
                            folder.id,
                            folder.archivedAtMs === undefined,
                            folder.revision,
                          );
                          await refresh();
                        }}
                        className="min-h-11 rounded-lg border bg-white px-2 text-xs font-semibold"
                      >
                        {folder.archivedAtMs === undefined
                          ? "Archive"
                          : "Restore"}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "tags" && (
            <section className="rounded-xl border bg-white p-3">
              <h3 className="font-bold">Tags</h3>
              <div className="mt-2 flex gap-2">
                <input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createPlannerTag();
                    }
                  }}
                  placeholder="New tag"
                  className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"
                />
                <button
                  onClick={() => void createPlannerTag()}
                  className="min-h-11 rounded-lg border px-3 font-semibold"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.length ? (
                  tags.map((tag) => (
                    <span
                      key={tag.key}
                      className="rounded-full border bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span
                        className="mr-1 inline-block h-2 w-2 rounded-full"
                        style={{ background: tag.color }}
                      />
                      #{tag.name}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No planner tags yet. Existing tags remain available in
                    legacy management.
                  </p>
                )}
              </div>
            </section>
          )}

          {(tab === "inbox" ||
            tab === "today" ||
            tab === "upcoming" ||
            tab === "historical") && (
            <section className="space-y-2" aria-live="polite">
              {shown.length === 0 && (
                <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
                  Nothing here yet.
                </div>
              )}
              {shown.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border bg-white p-3"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ background: item.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{item.title}</h3>
                      <p className="text-xs text-slate-500">
                        {minutes(item.plannedDurationSeconds)}m ·{" "}
                        {item.durationMode} · {item.schedulingMode}
                        {item.placementStartMinutes !== null
                          ? ` · ${formatClockMinutes(item.placementStartMinutes)}`
                          : ""}
                      </p>
                    </div>
                    {item.status === "completed" && (
                      <span className="text-xs font-bold text-emerald-700">
                        Done
                      </span>
                    )}
                  </div>
                  {tags.length > 0 && item.status !== "completed" && (
                    <details className="mt-2 rounded-lg bg-slate-50 px-2">
                      <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold">
                        Tags
                        {item.tagIds.length ? ` · ${item.tagIds.length}` : ""}
                      </summary>
                      <div className="flex flex-wrap gap-1 pb-2">
                        {tags.map((tag) => {
                          const selected = item.tagIds.includes(
                            tag.storageValue,
                          );
                          return (
                            <button
                              type="button"
                              key={tag.key}
                              aria-pressed={selected}
                              onClick={async () => {
                                await updateTaskOccurrence(item.id, {
                                  tagIds: selected
                                    ? item.tagIds.filter(
                                        (value) => value !== tag.storageValue,
                                      )
                                    : [...item.tagIds, tag.storageValue],
                                });
                                await refresh();
                              }}
                              className={`min-h-9 rounded-full border px-3 text-xs ${selected ? "border-indigo-500 bg-indigo-50" : "bg-white"}`}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  )}
                  {item.status === "inbox" && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        onClick={async () => {
                          await scheduleTaskOccurrence(item.id, today);
                          await refresh();
                        }}
                        className="min-h-11 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white"
                      >
                        Plan today
                      </button>
                      {!item.activityDefinitionId ? (
                        <button
                          onClick={async () => {
                            await promoteOneOffTask(item.id);
                            await refresh();
                          }}
                          className="min-h-11 rounded-lg border px-3 text-sm font-semibold"
                        >
                          Make reusable
                        </button>
                      ) : (
                        <span className="flex items-center justify-center text-xs text-slate-500">
                          Reusable
                        </span>
                      )}
                      <select
                        aria-label={`Move ${item.title} to list`}
                        defaultValue=""
                        onChange={async (event) => {
                          if (!event.target.value) return;
                          await organizeTaskOccurrence(item.id, {
                            folderId: event.target.value,
                          });
                          await refresh();
                        }}
                        className="col-span-2 min-h-11 rounded-lg border px-2 text-sm"
                      >
                        <option value="">Move to a list…</option>
                        {flatFolders
                          .filter((folder) => !folder.effectivelyArchived)
                          .map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {" ".repeat(folder.depth)}
                              {folder.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  {tab === "historical" && item.status === "completed" && (
                    <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
                      Correct recorded time
                      <input
                        aria-label={`${item.title} recorded minutes`}
                        type="number"
                        min="0"
                        defaultValue={Math.round(
                          item.actualFocusedSeconds / 60,
                        )}
                        onBlur={async (event) => {
                          await updateTaskOccurrence(item.id, {
                            actualFocusedSeconds:
                              Math.max(0, Number(event.target.value) || 0) * 60,
                          });
                          await refresh();
                        }}
                        className="min-h-11 w-24 rounded-lg border px-2"
                      />{" "}
                      min
                    </label>
                  )}
                </article>
              ))}
            </section>
          )}

          {tab === "historical" && (
            <section className="rounded-xl border bg-white p-3">
              <h3 className="font-bold">Explicit conversion</h3>
              <p className="text-xs text-slate-600">
                Legacy definitions and timer history remain unchanged. Convert
                only the items you want in the new planner.
              </p>
              <div className="mt-2 space-y-2">
                {legacyDefinitions.map((definition) => (
                  <div
                    key={definition.id}
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-2"
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: definition.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {definition.name}
                    </span>
                    <button
                      onClick={async () => {
                        await updateActivityDefinition(
                          definition.id,
                          { planningEnabled: true },
                          definition.revision,
                        );
                        await refresh();
                      }}
                      className="min-h-11 rounded-lg border bg-white px-3 text-xs font-semibold"
                    >
                      Enable planner
                    </button>
                  </div>
                ))}
                {legacyDefinitions.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No unconverted definitions.
                  </p>
                )}
              </div>
            </section>
          )}

          {tab !== "historical" && definitions.length > 0 && (
            <details className="rounded-xl border bg-white p-3">
              <summary className="min-h-11 cursor-pointer font-bold">
                Reusable planning rules ({definitions.length})
              </summary>
              <div className="space-y-3">
                {definitions.map((definition) => (
                  <DefinitionPlannerEditor
                    key={definition.id}
                    definition={definition}
                    folders={flatFolders}
                    onSaved={refresh}
                  />
                ))}
              </div>
            </details>
          )}
          <button
            onClick={onOpenCatalog}
            className="min-h-11 w-full rounded-xl border bg-white font-semibold"
          >
            Reusable catalog, Life Areas &amp; history adoption
          </button>
          <button
            onClick={onOpenLegacy}
            className="min-h-11 w-full rounded-xl border bg-white font-semibold"
          >
            Timer lists, templates, tags &amp; advanced setup
          </button>
        </main>
      </div>
    </div>
  );
}

function DefinitionPlannerEditor({
  definition,
  folders,
  onSaved,
}: {
  definition: ActivityDefinitionRecord;
  folders: ReturnType<typeof flattenFolderTree>;
  onSaved: () => Promise<void>;
}) {
  const [estimate, setEstimate] = useState<{
    seconds: number;
    sampleCount: number;
  } | null>(null);
  useEffect(() => {
    void getAdaptiveEstimate(definition.id)
      .then(setEstimate)
      .catch(() => setEstimate(null));
  }, [definition.id]);
  const save = async (changes: Partial<ActivityDefinitionRecord>) => {
    await updateActivityDefinition(definition.id, changes, definition.revision);
    await onSaved();
  };
  return (
    <div className="rounded-lg border p-2">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: definition.color }}
        />
        <strong className="min-w-0 flex-1 truncate">{definition.name}</strong>
        {estimate && (
          <span className="text-[11px] text-slate-500">
            avg {Math.round(estimate.seconds / 60)}m · {estimate.sampleCount}
          </span>
        )}
        <label className="flex min-h-11 items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={definition.planningEnabled}
            onChange={(event) =>
              void save({ planningEnabled: event.target.checked })
            }
          />{" "}
          Planner
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label={`${definition.name} list`}
          value={definition.folderId || ""}
          onChange={(event) =>
            void save({ folderId: event.target.value || null })
          }
          className="min-h-11 min-w-0 rounded-lg border px-2 text-sm"
        >
          <option value="">No list</option>
          {folders
            .filter((folder) => !folder.effectivelyArchived)
            .map((folder) => (
              <option key={folder.id} value={folder.id}>
                {" ".repeat(folder.depth)}
                {folder.name}
              </option>
            ))}
        </select>
        <select
          aria-label={`${definition.name} duration model`}
          value={definition.durationMode}
          onChange={(event) =>
            void save({
              durationMode: event.target
                .value as ActivityDefinitionRecord["durationMode"],
            })
          }
          className="min-h-11 rounded-lg border px-2 text-sm"
        >
          <option value="fixed">Fixed duration</option>
          <option value="adaptive">Adaptive duration</option>
        </select>
        <select
          aria-label={`${definition.name} scheduling`}
          value={definition.schedulingMode}
          onChange={(event) =>
            void save({
              schedulingMode: event.target
                .value as ActivityDefinitionRecord["schedulingMode"],
            })
          }
          className="min-h-11 rounded-lg border px-2 text-sm"
        >
          <option value="flexible">Flexible</option>
          <option value="exact">Exact time</option>
          <option value="window">Allowed window</option>
        </select>
        <select
          aria-label={`${definition.name} recurrence`}
          value={definition.recurrenceRule.type}
          onChange={(event) => {
            const type = event.target.value;
            const now = new Date();
            void save({
              recurrenceRule:
                type === "daily"
                  ? { type: "daily" }
                  : type === "weekdays"
                    ? { type: "weekdays", days: [1, 2, 3, 4, 5] }
                    : type === "monthly"
                      ? { type: "monthly", days: [now.getDate()] }
                      : type === "yearly"
                        ? {
                            type: "yearly",
                            dates: [
                              `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
                            ],
                          }
                        : type === "interval"
                          ? {
                              type: "interval",
                              everyDays: 2,
                              anchorDate: localDateKey(now),
                            }
                          : { type: "none" },
            });
          }}
          className="min-h-11 rounded-lg border px-2 text-sm"
        >
          <option value="none">No repeat</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="interval">Every 2 days</option>
        </select>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold">
          Baseline minutes
          <input
            type="number"
            min="1"
            defaultValue={Math.round(
              (definition.baselineDurationSeconds || 3600) / 60,
            )}
            onBlur={(event) =>
              void save({
                baselineDurationSeconds:
                  Math.max(1, Number(event.target.value) || 1) * 60,
              })
            }
            className="mt-1 min-h-11 w-full rounded-lg border px-2"
          />
        </label>
        <label className="text-xs font-semibold">
          Minimum minutes
          <input
            type="number"
            min="0"
            defaultValue={Math.round(
              (definition.minimumDurationSeconds || 0) / 60,
            )}
            onBlur={(event) =>
              void save({
                minimumDurationSeconds:
                  Math.max(0, Number(event.target.value) || 0) * 60,
              })
            }
            className="mt-1 min-h-11 w-full rounded-lg border px-2"
          />
        </label>
        {definition.schedulingMode === "exact" && (
          <label className="col-span-2 text-xs font-semibold">
            Exact start
            <input
              type="time"
              value={formatClockMinutes(definition.exactStartMinutes ?? 480)}
              onChange={(event) => {
                const [hours, minutes] = event.target.value
                  .split(":")
                  .map(Number);
                void save({ exactStartMinutes: hours * 60 + minutes });
              }}
              className="mt-1 min-h-11 w-full rounded-lg border px-2"
            />
          </label>
        )}
        {definition.schedulingMode === "window" && (
          <>
            <label className="text-xs font-semibold">
              Window start
              <input
                type="time"
                value={formatClockMinutes(definition.windowStartMinutes ?? 480)}
                onChange={(event) => {
                  const [hours, minutes] = event.target.value
                    .split(":")
                    .map(Number);
                  void save({ windowStartMinutes: hours * 60 + minutes });
                }}
                className="mt-1 min-h-11 w-full rounded-lg border px-2"
              />
            </label>
            <label className="text-xs font-semibold">
              Window end
              <input
                type="time"
                value={formatClockMinutes(definition.windowEndMinutes ?? 1320)}
                onChange={(event) => {
                  const [hours, minutes] = event.target.value
                    .split(":")
                    .map(Number);
                  void save({ windowEndMinutes: hours * 60 + minutes });
                }}
                className="mt-1 min-h-11 w-full rounded-lg border px-2"
              />
            </label>
          </>
        )}
        <label className="col-span-2 flex min-h-11 items-center justify-between rounded-lg border px-3 text-sm">
          <span>Missed recurrence</span>
          <select
            value={definition.rolloverPolicy}
            onChange={(event) =>
              void save({
                rolloverPolicy: event.target
                  .value as ActivityDefinitionRecord["rolloverPolicy"],
              })
            }
            className="min-h-9 rounded border px-2"
          >
            <option value="carry">Carry one</option>
            <option value="skip">Skip missed</option>
          </select>
        </label>
      </div>
    </div>
  );
}
