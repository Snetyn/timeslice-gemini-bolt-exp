import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createActivityDefinition,
  createFolder,
  createLifeArea,
  setActivityDefinitionArchived,
  setFolderArchived,
  setLifeAreaArchived,
  updateActivityDefinition,
  updateFolder,
  updateLifeArea,
} from "../data/activityCatalogRepository";
import {
  adoptLegacyOrganizerTags,
  compatibilityCounts,
  createOrganizerTag,
  migrateOrganizer,
  readOrganizerSnapshot,
  repairOrganizerCompatibility,
  setOrganizerTagArchived,
  subscribeOrganizer,
  updateOrganizerTag,
  type OrganizerSnapshot,
} from "../data/organizerRepository";
import {
  completeTaskOccurrence,
  createInboxTask,
  updateTaskOccurrence,
} from "../data/taskPlanningRepository";
import {
  flattenFolderTree,
  isEffectivelyArchived,
} from "../domain/activityCatalog";
import {
  canonicalizeOrganizerTagIds,
  matchesOrganizerTags,
  matchesOrganizerView,
  type OrganizerSmartView,
  type OrganizerTagMatch,
  type OrganizerTagRecord,
} from "../domain/organizer";
import {
  formatClockMinutes,
  localDateKey,
  parseClockMinutes,
  type TaskOccurrenceRecord,
  type TaskRecurrenceRule,
} from "../domain/taskPlanning";

type Editor =
  | { type: "new-task" }
  | { type: "task"; id: string }
  | { type: "new-activity" }
  | { type: "activity"; id: string }
  | { type: "new-collection"; kind: "folder" | "list" }
  | { type: "collection"; id: string }
  | { type: "new-tag" }
  | { type: "tag"; id: string }
  | { type: "new-area" }
  | { type: "area"; id: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onTagsChanged?: (tags: OrganizerTagRecord[]) => void;
  onTaskChanged?: (task: TaskOccurrenceRecord) => void;
  onDefinitionTagsChanged?: (definitionId: string, tagIds: string[]) => void;
};

const emptySnapshot: OrganizerSnapshot = {
  collections: [],
  definitions: [],
  areas: [],
  occurrences: [],
  tags: [],
};

const smartViews: Array<[OrganizerSmartView, string]> = [
  ["all", "All"],
  ["inbox", "Inbox"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
];

const formatMinutes = (seconds: number) =>
  `${Math.max(0, Math.round(seconds / 60))}m`;

function tagsForDisplay(ids: string[], tags: OrganizerTagRecord[]) {
  const canonical = new Set(canonicalizeOrganizerTagIds(ids, tags));
  return tags.filter((tag) => canonical.has(tag.id));
}

export function UnifiedOrganizer({
  open,
  onClose,
  onTagsChanged,
  onTaskChanged,
  onDefinitionTagsChanged,
}: Props) {
  const [snapshot, setSnapshot] = useState<OrganizerSnapshot>(emptySnapshot);
  const [view, setView] = useState<OrganizerSmartView>("all");
  const [query, setQuery] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatch, setTagMatch] = useState<OrganizerTagMatch>("any");
  const [showArchived, setShowArchived] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [compatibility, setCompatibility] = useState({
    templates: 0,
    categories: 0,
    legacyRpgTags: 0,
  });
  const [compatibilityMessage, setCompatibilityMessage] = useState("");

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const refresh = useCallback(async () => {
    try {
      const next = await readOrganizerSnapshot();
      setSnapshot(next);
      setCompatibility(await compatibilityCounts());
      onTagsChanged?.(next.tags);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Organizer could not be loaded.",
      );
    }
  }, [onTagsChanged]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void migrateOrganizer()
      .then(() => !cancelled && refresh())
      .catch(
        (reason) =>
          !cancelled &&
          setError(
            reason instanceof Error
              ? reason.message
              : "Organizer migration failed.",
          ),
      );
    const unsubscribe = subscribeOrganizer(() => void refresh());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    if (!window.history.state?.timesliceOrganizer) {
      window.history.pushState({ timesliceOrganizer: true }, "");
    }
    const handleBack = () => {
      if (editorRef.current) setEditor(null);
      else onClose();
    };
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [onClose, open]);

  const openEditor = (next: Editor) => {
    setEditor(next);
    window.history.pushState(
      { timesliceOrganizer: true, editor: next.type },
      "",
    );
  };
  const closeEditor = () => {
    if (window.history.state?.editor) window.history.back();
    else setEditor(null);
  };
  const closeOrganizer = () => {
    if (window.history.state?.timesliceOrganizer) window.history.back();
    else onClose();
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const flatCollections = useMemo(
    () => flattenFolderTree(snapshot.collections, true),
    [snapshot.collections],
  );
  const visibleCollections = useMemo(() => {
    const searchMatches = new Set<string>();
    if (normalizedQuery) {
      const byId = new Map(flatCollections.map((item) => [item.id, item]));
      for (const collection of flatCollections) {
        if (!collection.name.toLocaleLowerCase().includes(normalizedQuery))
          continue;
        let current: (typeof flatCollections)[number] | undefined = collection;
        while (current) {
          searchMatches.add(current.id);
          current = current.parentId ? byId.get(current.parentId) : undefined;
        }
      }
    }
    const result: typeof flatCollections = [];
    const hiddenParents = new Set<string>();
    for (const collection of flatCollections) {
      if (collection.parentId && hiddenParents.has(collection.parentId)) {
        hiddenParents.add(collection.id);
        continue;
      }
      if (
        collection.kind === "folder" &&
        !expandedFolders.has(collection.id) &&
        !normalizedQuery
      )
        hiddenParents.add(collection.id);
      if (
        (showArchived || !collection.effectivelyArchived) &&
        (!normalizedQuery || searchMatches.has(collection.id))
      )
        result.push(collection);
    }
    return result;
  }, [expandedFolders, flatCollections, normalizedQuery, showArchived]);

  const selectedListIds = useMemo(() => {
    if (!selectedCollectionId) return null;
    const selected = snapshot.collections.find(
      (collection) => collection.id === selectedCollectionId,
    );
    if (!selected) return null;
    if (selected.kind === "list") return new Set([selected.id]);
    const ids = new Set<string>();
    const parents = new Set([selected.id]);
    for (const item of flatCollections) {
      if (item.parentId && parents.has(item.parentId)) {
        if (item.kind === "folder") parents.add(item.id);
        else ids.add(item.id);
      }
    }
    return ids;
  }, [flatCollections, selectedCollectionId, snapshot.collections]);

  const filteredTasks = useMemo(
    () =>
      snapshot.occurrences.filter((task) => {
        const list = snapshot.collections.find(
          (collection) => collection.id === task.folderId,
        );
        const tagNames = tagsForDisplay(task.tagIds, snapshot.tags).map((tag) =>
          tag.name.toLocaleLowerCase(),
        );
        const matchesText =
          !normalizedQuery ||
          task.title.toLocaleLowerCase().includes(normalizedQuery) ||
          Boolean(list?.name.toLocaleLowerCase().includes(normalizedQuery)) ||
          tagNames.some((name) => name.includes(normalizedQuery));
        const matchesList =
          !selectedListIds ||
          Boolean(task.folderId && selectedListIds.has(task.folderId));
        return (
          matchesText &&
          matchesList &&
          matchesOrganizerView(task, view, localDateKey()) &&
          matchesOrganizerTags(
            task.tagIds,
            selectedTags,
            tagMatch,
            snapshot.tags,
          )
        );
      }),
    [
      normalizedQuery,
      selectedListIds,
      selectedTags,
      snapshot.collections,
      snapshot.occurrences,
      snapshot.tags,
      tagMatch,
      view,
    ],
  );
  const filteredDefinitions = useMemo(
    () =>
      snapshot.definitions.filter((definition) => {
        if (!showArchived && definition.archivedAtMs !== undefined)
          return false;
        if (
          !showArchived &&
          definition.folderId &&
          isEffectivelyArchived(definition.folderId, snapshot.collections)
        )
          return false;
        return (
          (!normalizedQuery ||
            definition.name.toLocaleLowerCase().includes(normalizedQuery) ||
            definition.aliases.some((alias) =>
              alias.includes(normalizedQuery),
            ) ||
            tagsForDisplay(definition.tagIds || [], snapshot.tags).some((tag) =>
              tag.name.toLocaleLowerCase().includes(normalizedQuery),
            )) &&
          (!selectedListIds ||
            Boolean(
              definition.folderId && selectedListIds.has(definition.folderId),
            )) &&
          matchesOrganizerTags(
            definition.tagIds,
            selectedTags,
            tagMatch,
            snapshot.tags,
          )
        );
      }),
    [
      normalizedQuery,
      selectedListIds,
      selectedTags,
      showArchived,
      snapshot.collections,
      snapshot.definitions,
      snapshot.tags,
      tagMatch,
    ],
  );

  if (!open) return null;
  const activeTags = snapshot.tags
    .filter((tag) => showArchived || tag.archivedAtMs === undefined)
    .filter(
      (tag) =>
        !normalizedQuery ||
        tag.name.toLocaleLowerCase().includes(normalizedQuery) ||
        selectedTags.includes(tag.id),
    )
    .sort(
      (left, right) =>
        Number(selectedTags.includes(right.id)) -
          Number(selectedTags.includes(left.id)) ||
        left.order - right.order ||
        left.name.localeCompare(right.name),
    );

  return (
    <div
      className="fixed inset-0 z-[86] bg-slate-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organizer-title"
      data-testid="unified-organizer"
    >
      <div className="mx-auto flex h-[100dvh] max-w-5xl flex-col overflow-hidden">
        <header className="sticky top-0 z-20 border-b bg-white/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex min-h-12 items-center gap-2">
            <button
              onClick={closeOrganizer}
              className="min-h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold"
              aria-label="Back to Timer"
            >
              ← Timer
            </button>
            <div className="min-w-0 flex-1">
              <h2 id="organizer-title" className="truncate text-lg font-bold">
                Tasks &amp; Activities
              </h2>
            </div>
            <button
              onClick={() => openEditor({ type: "new-task" })}
              className="min-h-11 shrink-0 rounded-lg bg-indigo-600 px-3 text-sm font-bold text-white"
            >
              + Add
            </button>
          </div>
          <label className="block pb-2">
            <span className="sr-only">
              Search tasks, activities, lists, and tags
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks, activities, lists, and tags"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
          </label>
        </header>

        <main className="flex-1 overflow-y-auto px-2 py-2 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-3">
          {error && (
            <div
              role="alert"
              className="mb-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
              <button onClick={() => void refresh()} className="ml-2 underline">
                Retry
              </button>
            </div>
          )}

          <section
            className="rounded-xl border bg-white p-2"
            aria-labelledby="smart-views-title"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 id="smart-views-title" className="font-bold">
                Smart views
              </h3>
              <label className="flex min-h-11 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                />
                Archived
              </label>
            </div>
            <div
              className="flex gap-1 overflow-x-auto pb-1"
              role="group"
              aria-label="Smart task views"
            >
              {smartViews.map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold ${view === id ? "bg-slate-950 text-white" : "border bg-white"}`}
                >
                  {label}
                  <span className="ml-1 text-xs opacity-70">
                    {
                      snapshot.occurrences.filter((task) =>
                        matchesOrganizerView(task, id, localDateKey()),
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="mt-2 grid gap-2 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-2">
              <section
                className="rounded-xl border bg-white p-2"
                aria-labelledby="collections-title"
              >
                <div className="flex min-h-11 items-center gap-1">
                  <h3 id="collections-title" className="mr-auto font-bold">
                    Folders &amp; Lists
                  </h3>
                  <button
                    onClick={() =>
                      openEditor({ type: "new-collection", kind: "folder" })
                    }
                    className="min-h-11 rounded-lg border px-2 text-xs font-semibold"
                  >
                    + Folder
                  </button>
                  <button
                    onClick={() =>
                      openEditor({ type: "new-collection", kind: "list" })
                    }
                    className="min-h-11 rounded-lg border px-2 text-xs font-semibold"
                  >
                    + List
                  </button>
                </div>
                <button
                  onClick={() => setSelectedCollectionId(null)}
                  aria-pressed={selectedCollectionId === null}
                  className={`flex min-h-11 w-full items-center rounded-lg px-2 text-sm font-semibold ${selectedCollectionId === null ? "bg-indigo-50 text-indigo-800" : "hover:bg-slate-50"}`}
                >
                  ◉ All collections
                </button>
                <div
                  className="space-y-0.5"
                  role="tree"
                  aria-label="Folder and list hierarchy"
                >
                  {visibleCollections.map((collection) => {
                    const selected = selectedCollectionId === collection.id;
                    const count = snapshot.occurrences.filter((task) =>
                      collection.kind === "list"
                        ? task.folderId === collection.id
                        : false,
                    ).length;
                    return (
                      <div
                        key={collection.id}
                        className={`flex min-h-11 items-center rounded-lg ${selected ? "bg-indigo-50 text-indigo-900" : "hover:bg-slate-50"} ${collection.effectivelyArchived ? "opacity-50" : ""}`}
                        style={{
                          paddingLeft: `${4 + Math.min(collection.depth, 4) * 14}px`,
                        }}
                        role="treeitem"
                        aria-level={collection.depth + 1}
                      >
                        {collection.kind === "folder" ? (
                          <button
                            onClick={() =>
                              setExpandedFolders((current) => {
                                const next = new Set(current);
                                if (next.has(collection.id))
                                  next.delete(collection.id);
                                else next.add(collection.id);
                                return next;
                              })
                            }
                            className="min-h-11 min-w-8"
                            aria-label={`${expandedFolders.has(collection.id) ? "Collapse" : "Expand"} ${collection.name}`}
                          >
                            {expandedFolders.has(collection.id) ? "▾" : "▸"}
                          </button>
                        ) : (
                          <span
                            className="inline-block w-8 text-center"
                            aria-hidden="true"
                          >
                            •
                          </span>
                        )}
                        <button
                          onClick={() => setSelectedCollectionId(collection.id)}
                          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-sm"
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ background: collection.color }}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {collection.name}
                          </span>
                          {collection.kind === "list" && (
                            <span className="text-xs text-slate-500">
                              {count}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() =>
                            openEditor({
                              type: "collection",
                              id: collection.id,
                            })
                          }
                          className="min-h-11 min-w-11 rounded-lg"
                          aria-label={`Edit ${collection.name}`}
                        >
                          ⋮
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section
                className="rounded-xl border bg-white p-2"
                aria-labelledby="tags-title"
              >
                <div className="flex min-h-11 items-center justify-between">
                  <h3 id="tags-title" className="font-bold">
                    Tags
                  </h3>
                  <button
                    onClick={() => openEditor({ type: "new-tag" })}
                    className="min-h-11 rounded-lg border px-3 text-xs font-semibold"
                  >
                    + Tag
                  </button>
                </div>
                {selectedTags.length > 0 && (
                  <div className="mb-2 flex items-center gap-1 rounded-lg bg-slate-50 p-1">
                    <button
                      onClick={() => setTagMatch("any")}
                      aria-pressed={tagMatch === "any"}
                      className={`min-h-9 flex-1 rounded-md text-xs font-bold ${tagMatch === "any" ? "bg-white shadow" : ""}`}
                    >
                      Any
                    </button>
                    <button
                      onClick={() => setTagMatch("all")}
                      aria-pressed={tagMatch === "all"}
                      className={`min-h-9 flex-1 rounded-md text-xs font-bold ${tagMatch === "all" ? "bg-white shadow" : ""}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSelectedTags([])}
                      className="min-h-9 rounded-md px-2 text-xs font-semibold text-indigo-700"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
                  {activeTags.map((tag) => {
                    const selected = selectedTags.includes(tag.id);
                    return (
                      <span
                        key={tag.id}
                        className={`inline-flex min-h-10 items-center rounded-full border bg-white ${tag.archivedAtMs !== undefined ? "opacity-50" : ""}`}
                      >
                        <button
                          onClick={() =>
                            setSelectedTags((current) =>
                              selected
                                ? current.filter((id) => id !== tag.id)
                                : [...current, tag.id],
                            )
                          }
                          aria-pressed={selected}
                          className={`min-h-10 rounded-l-full px-3 text-xs font-semibold ${selected ? "bg-indigo-50 text-indigo-900" : ""}`}
                        >
                          <span
                            className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: tag.color }}
                          />
                          #{tag.name}
                        </button>
                        <button
                          onClick={() =>
                            openEditor({ type: "tag", id: tag.id })
                          }
                          className="min-h-10 min-w-9 rounded-r-full text-slate-500"
                          aria-label={`Edit tag ${tag.name}`}
                        >
                          ⋮
                        </button>
                      </span>
                    );
                  })}
                  {activeTags.length === 0 && (
                    <p className="p-2 text-sm text-slate-500">No tags yet.</p>
                  )}
                </div>
              </section>

              <LifeAreasSection snapshot={snapshot} openEditor={openEditor} />
            </aside>

            <div className="min-w-0 space-y-2">
              <section
                className="rounded-xl border bg-white p-2"
                aria-labelledby="tasks-title"
              >
                <div className="flex min-h-11 items-center justify-between gap-2">
                  <div>
                    <h3 id="tasks-title" className="font-bold">
                      Tasks
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      One occurrence in Inbox, Today, or a List.
                    </p>
                  </div>
                  <button
                    onClick={() => openEditor({ type: "new-task" })}
                    className="min-h-11 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white"
                  >
                    + Task
                  </button>
                </div>
                <div className="space-y-1">
                  {filteredTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      snapshot={snapshot}
                      onEdit={() => openEditor({ type: "task", id: task.id })}
                    />
                  ))}
                  {filteredTasks.length === 0 && (
                    <Empty text="No tasks match this view." />
                  )}
                </div>
              </section>

              <section
                className="rounded-xl border bg-white p-2"
                aria-labelledby="activities-title"
              >
                <div className="flex min-h-11 items-center justify-between gap-2">
                  <div>
                    <h3 id="activities-title" className="font-bold">
                      Reusable Activities
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Reusable work definitions, separate from dated tasks.
                    </p>
                  </div>
                  <button
                    onClick={() => openEditor({ type: "new-activity" })}
                    className="min-h-11 rounded-lg border px-3 text-xs font-bold"
                  >
                    + Activity
                  </button>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {filteredDefinitions.map((definition) => (
                    <button
                      key={definition.id}
                      onClick={() =>
                        openEditor({ type: "activity", id: definition.id })
                      }
                      className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 text-left ${definition.archivedAtMs !== undefined ? "opacity-50" : ""}`}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: definition.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {definition.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatMinutes(
                          definition.baselineDurationSeconds || 3600,
                        )}
                      </span>
                    </button>
                  ))}
                  {filteredDefinitions.length === 0 && (
                    <Empty text="No reusable activities match." />
                  )}
                </div>
              </section>

              <details className="rounded-xl border bg-white p-2">
                <summary className="flex min-h-11 cursor-pointer items-center font-bold">
                  History{" "}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    Completed and missed tasks
                  </span>
                </summary>
                <div className="space-y-1 pt-1">
                  {snapshot.occurrences
                    .filter(
                      (task) =>
                        task.status === "completed" || task.status === "missed",
                    )
                    .slice(0, 50)
                    .map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        snapshot={snapshot}
                        onEdit={() => openEditor({ type: "task", id: task.id })}
                      />
                    ))}
                </div>
              </details>

              <details className="rounded-xl border border-dashed bg-white p-2">
                <summary className="flex min-h-11 cursor-pointer items-center font-bold">
                  Compatibility{" "}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    Legacy data remains intact
                  </span>
                </summary>
                <div className="grid grid-cols-3 gap-2 pb-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <strong className="block text-lg">
                      {compatibility.templates}
                    </strong>
                    Templates
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <strong className="block text-lg">
                      {compatibility.categories}
                    </strong>
                    Categories
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <strong className="block text-lg">
                      {compatibility.legacyRpgTags}
                    </strong>
                    Legacy tag records
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  Legacy keys and managers are retained for rollback. New edits
                  use the unified organizer and stable tags.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void adoptLegacyOrganizerTags()
                        .then((result) => {
                          setCompatibilityMessage(
                            result.adopted
                              ? `Adopted ${result.adopted} legacy tag changes.`
                              : "Legacy tags are already up to date.",
                          );
                          return refresh();
                        })
                        .catch((reason) =>
                          setCompatibilityMessage(
                            reason instanceof Error
                              ? reason.message
                              : "Legacy tag adoption failed.",
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                    className="min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50"
                  >
                    Adopt legacy tags
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void repairOrganizerCompatibility()
                        .then(() =>
                          setCompatibilityMessage(
                            "Compatibility mirrors repaired from canonical tags.",
                          ),
                        )
                        .catch((reason) =>
                          setCompatibilityMessage(
                            reason instanceof Error
                              ? reason.message
                              : "Compatibility repair failed.",
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                    className="min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50"
                  >
                    Repair legacy mirrors
                  </button>
                </div>
                {compatibilityMessage && (
                  <p role="status" className="mt-2 text-xs text-indigo-700">
                    {compatibilityMessage}
                  </p>
                )}
              </details>
            </div>
          </div>
        </main>
      </div>

      {editor && (
        <OrganizerEditor
          editor={editor}
          snapshot={snapshot}
          selectedCollectionId={selectedCollectionId}
          busy={busy}
          setBusy={setBusy}
          onClose={closeEditor}
          onSaved={async (result) => {
            if (result?.task) onTaskChanged?.(result.task);
            if (result?.definition)
              onDefinitionTagsChanged?.(
                result.definition.id,
                result.definition.tagIds || [],
              );
            await refresh();
            closeEditor();
          }}
        />
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="col-span-full rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function TaskRow({
  task,
  snapshot,
  onEdit,
}: {
  task: TaskOccurrenceRecord;
  snapshot: OrganizerSnapshot;
  onEdit: () => void;
}) {
  const list = snapshot.collections.find((item) => item.id === task.folderId);
  const archived = Boolean(
    task.folderId && isEffectivelyArchived(task.folderId, snapshot.collections),
  );
  return (
    <button
      onClick={onEdit}
      className="flex min-h-12 w-full items-start gap-2 rounded-lg border px-2 py-2 text-left"
    >
      <span
        className="mt-1 h-3 w-3 shrink-0 rounded-full"
        style={{ background: task.color }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {task.title}
        </span>
        <span className="flex flex-wrap gap-1 text-[11px] text-slate-500">
          <span>{formatMinutes(task.plannedDurationSeconds)}</span>
          {list && (
            <span>
              · {list.name}
              {archived ? " (archived)" : ""}
            </span>
          )}
          {task.localDate && <span>· {task.localDate}</span>}
          {tagsForDisplay(task.tagIds, snapshot.tags)
            .slice(0, 3)
            .map((tag) => (
              <span key={tag.id} style={{ color: tag.color }}>
                #{tag.name}
              </span>
            ))}
        </span>
      </span>
      <span
        className={`rounded-full px-2 py-1 text-[10px] font-bold ${task.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
      >
        {task.status}
      </span>
    </button>
  );
}

function LifeAreasSection({
  snapshot,
  openEditor,
}: {
  snapshot: OrganizerSnapshot;
  openEditor: (editor: Editor) => void;
}) {
  return (
    <section
      className="rounded-xl border bg-white p-2"
      aria-labelledby="areas-title"
    >
      <div className="flex min-h-11 items-center justify-between">
        <div>
          <h3 id="areas-title" className="font-bold">
            Life Areas
          </h3>
          <p className="text-[11px] text-slate-500">
            Broad optional statistics
          </p>
        </div>
        <button
          onClick={() => openEditor({ type: "new-area" })}
          className="min-h-11 rounded-lg border px-3 text-xs font-semibold"
        >
          + Area
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {snapshot.areas.map((area) => (
          <button
            key={area.id}
            onClick={() => openEditor({ type: "area", id: area.id })}
            className={`min-h-10 rounded-full border px-3 text-xs font-semibold ${area.archivedAtMs !== undefined ? "opacity-50" : ""}`}
          >
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: area.color }}
            />
            {area.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function OrganizerEditor({
  editor,
  snapshot,
  selectedCollectionId,
  busy,
  setBusy,
  onClose,
  onSaved,
}: {
  editor: Editor;
  snapshot: OrganizerSnapshot;
  selectedCollectionId: string | null;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onClose: () => void;
  onSaved: (result?: {
    task?: TaskOccurrenceRecord;
    definition?: { id: string; tagIds?: string[] };
  }) => Promise<void>;
}) {
  const task =
    editor.type === "task"
      ? snapshot.occurrences.find((item) => item.id === editor.id)
      : undefined;
  const definition =
    editor.type === "activity"
      ? snapshot.definitions.find((item) => item.id === editor.id)
      : undefined;
  const collection =
    editor.type === "collection"
      ? snapshot.collections.find((item) => item.id === editor.id)
      : undefined;
  const tag =
    editor.type === "tag"
      ? snapshot.tags.find((item) => item.id === editor.id)
      : undefined;
  const area =
    editor.type === "area"
      ? snapshot.areas.find((item) => item.id === editor.id)
      : undefined;
  const selectedCollection = snapshot.collections.find(
    (item) => item.id === selectedCollectionId && item.kind === "list",
  );
  const [name, setName] = useState(
    task?.title ||
      definition?.name ||
      collection?.name ||
      tag?.name ||
      area?.name ||
      "",
  );
  const [color, setColor] = useState(
    task?.color ||
      definition?.color ||
      collection?.color ||
      tag?.color ||
      area?.color ||
      "#6366f1",
  );
  const [listId, setListId] = useState(
    task?.folderId || definition?.folderId || selectedCollection?.id || "",
  );
  const [parentId, setParentId] = useState(
    collection?.parentId ||
      (selectedCollectionId &&
      snapshot.collections.find((item) => item.id === selectedCollectionId)
        ?.kind === "folder"
        ? selectedCollectionId
        : ""),
  );
  const [lifeAreaId, setLifeAreaId] = useState(definition?.lifeAreaId || "");
  const [date, setDate] = useState(task?.localDate || "");
  const [duration, setDuration] = useState(
    String(
      Math.round(
        (task?.plannedDurationSeconds ||
          definition?.baselineDurationSeconds ||
          3600) / 60,
      ),
    ),
  );
  const [minimumDuration, setMinimumDuration] = useState(
    String(
      Math.round(
        (task?.minimumDurationSeconds ||
          definition?.minimumDurationSeconds ||
          1800) / 60,
      ),
    ),
  );
  const [durationMode, setDurationMode] = useState<"fixed" | "adaptive">(
    task?.durationMode || definition?.durationMode || "fixed",
  );
  const [schedulingMode, setSchedulingMode] = useState<
    "flexible" | "exact" | "window"
  >(task?.schedulingMode || definition?.schedulingMode || "flexible");
  const [exactStart, setExactStart] = useState(
    formatClockMinutes(
      task?.exactStartMinutes ?? definition?.exactStartMinutes ?? 540,
    ),
  );
  const [windowStart, setWindowStart] = useState(
    formatClockMinutes(
      task?.windowStartMinutes ?? definition?.windowStartMinutes ?? 480,
    ),
  );
  const [windowEnd, setWindowEnd] = useState(
    formatClockMinutes(
      task?.windowEndMinutes ?? definition?.windowEndMinutes ?? 1320,
    ),
  );
  const [protectedActivity, setProtectedActivity] = useState(
    Boolean(definition?.protected),
  );
  const [recurrenceType, setRecurrenceType] = useState<
    TaskRecurrenceRule["type"]
  >(definition?.recurrenceRule?.type || "none");
  const [recurrenceValues, setRecurrenceValues] = useState(() => {
    const rule = definition?.recurrenceRule;
    if (!rule || rule.type === "none" || rule.type === "daily") return "";
    if (rule.type === "weekdays" || rule.type === "monthly")
      return rule.days.join(", ");
    if (rule.type === "yearly") return rule.dates.join(", ");
    return String(rule.everyDays);
  });
  const [rolloverPolicy, setRolloverPolicy] = useState<"carry" | "skip">(
    definition?.rolloverPolicy || "carry",
  );
  const [order, setOrder] = useState(
    String(
      definition?.order ?? collection?.order ?? tag?.order ?? area?.order ?? 0,
    ),
  );
  const [tagIds, setTagIds] = useState<string[]>(
    canonicalizeOrganizerTagIds(
      task?.tagIds || definition?.tagIds || [],
      snapshot.tags,
    ),
  );
  const [reusable, setReusable] = useState(false);
  const [taskStatus, setTaskStatus] = useState<TaskOccurrenceRecord["status"]>(
    task?.status || "inbox",
  );
  const [localError, setLocalError] = useState("");
  const lists = snapshot.collections.filter(
    (item) =>
      item.kind === "list" &&
      !isEffectivelyArchived(item.id, snapshot.collections),
  );
  const folders = snapshot.collections.filter(
    (item) =>
      item.kind === "folder" &&
      !isEffectivelyArchived(item.id, snapshot.collections) &&
      item.id !== collection?.id,
  );
  const title =
    editor.type === "new-task"
      ? "Add task"
      : editor.type === "task"
        ? "Edit task"
        : editor.type === "new-activity"
          ? "Add reusable activity"
          : editor.type === "activity"
            ? "Edit activity"
            : editor.type === "new-collection"
              ? `Add ${editor.kind}`
              : editor.type === "collection"
                ? `Edit ${collection?.kind || "collection"}`
                : editor.type === "new-tag"
                  ? "Add tag"
                  : editor.type === "tag"
                    ? "Edit tag"
                    : editor.type === "new-area"
                      ? "Add Life Area"
                      : "Edit Life Area";

  const plannedSeconds = Math.max(1, Number(duration) || 60) * 60;
  const minimumSeconds = Math.min(
    plannedSeconds,
    Math.max(0, Number(minimumDuration) || 0) * 60,
  );
  const scheduleChanges = {
    schedulingMode,
    exactStartMinutes:
      schedulingMode === "exact" ? parseClockMinutes(exactStart) : null,
    windowStartMinutes:
      schedulingMode === "window" ? parseClockMinutes(windowStart) : null,
    windowEndMinutes:
      schedulingMode === "window" ? parseClockMinutes(windowEnd) : null,
    durationMode,
    minimumDurationSeconds: minimumSeconds,
  };
  const recurrenceRule: TaskRecurrenceRule = (() => {
    if (recurrenceType === "daily") return { type: "daily" };
    if (recurrenceType === "weekdays")
      return {
        type: "weekdays",
        days: recurrenceValues
          .split(",")
          .map(Number)
          .filter(
            (value) => Number.isInteger(value) && value >= 0 && value <= 6,
          ),
      };
    if (recurrenceType === "monthly")
      return {
        type: "monthly",
        days: recurrenceValues
          .split(",")
          .map(Number)
          .filter(
            (value) => Number.isInteger(value) && value >= 1 && value <= 31,
          ),
      };
    if (recurrenceType === "yearly")
      return {
        type: "yearly",
        dates: recurrenceValues
          .split(",")
          .map((value) => value.trim())
          .filter((value) => /^\d{2}-\d{2}$/.test(value)),
      };
    if (recurrenceType === "interval")
      return {
        type: "interval",
        everyDays: Math.max(1, Number(recurrenceValues) || 1),
        anchorDate: date || localDateKey(),
      };
    return { type: "none" };
  })();

  const save = async () => {
    if (!name.trim()) {
      setLocalError("A name is required.");
      return;
    }
    setBusy(true);
    setLocalError("");
    try {
      if (editor.type === "new-task") {
        let created = await createInboxTask({
          title: name,
          kind: reusable ? "reusable" : "one-off",
          folderId: listId || null,
          tagIds,
          baselineDurationSeconds: plannedSeconds,
          color,
          ...scheduleChanges,
          ...(reusable
            ? { recurrenceRule, rolloverPolicy, protected: protectedActivity }
            : {}),
        });
        created = await updateTaskOccurrence(created.id, {
          localDate: date || null,
          status: date || listId ? "planned" : "inbox",
          plannedDurationSeconds: plannedSeconds,
          ...scheduleChanges,
        });
        await onSaved({ task: created });
      } else if (editor.type === "task" && task) {
        let updated = await updateTaskOccurrence(task.id, {
          title: name,
          color,
          folderId: listId || null,
          tagIds,
          localDate: date || null,
          status: taskStatus === "completed" ? task.status : taskStatus,
          plannedDurationSeconds: plannedSeconds,
          ...(task.status === "completed" && taskStatus !== "completed"
            ? { completedAtMs: null, completionSnapshot: null }
            : {}),
          ...scheduleChanges,
        });
        if (taskStatus === "completed" && task.status !== "completed")
          updated = await completeTaskOccurrence(task.id);
        await onSaved({ task: updated });
      } else if (editor.type === "new-activity") {
        const created = (
          await createActivityDefinition({
            name,
            color,
            folderId: listId || null,
            lifeAreaId: lifeAreaId || null,
            tagIds,
            baselineDurationSeconds: plannedSeconds,
            planningEnabled: true,
            protected: protectedActivity,
            ...scheduleChanges,
            recurrenceRule,
            rolloverPolicy,
          })
        ).value;
        await onSaved({ definition: created });
      } else if (editor.type === "activity" && definition) {
        const updated = (
          await updateActivityDefinition(
            definition.id,
            {
              name,
              color,
              folderId: listId || null,
              lifeAreaId: lifeAreaId || null,
              tagIds,
              baselineDurationSeconds: plannedSeconds,
              protected: protectedActivity,
              order: Math.max(0, Number(order) || 0),
              ...scheduleChanges,
              recurrenceRule,
              rolloverPolicy,
            },
            definition.revision,
          )
        ).value;
        await onSaved({ definition: updated });
      } else if (editor.type === "new-collection") {
        await createFolder({
          name,
          color,
          kind: editor.kind,
          parentId: parentId || null,
        });
        await onSaved();
      } else if (editor.type === "collection" && collection) {
        await updateFolder(
          collection.id,
          {
            name,
            color,
            parentId: parentId || null,
            order: Math.max(0, Number(order) || 0),
          },
          collection.revision,
        );
        await onSaved();
      } else if (editor.type === "new-tag") {
        await createOrganizerTag({ name, color });
        await onSaved();
      } else if (editor.type === "tag" && tag) {
        await updateOrganizerTag(
          tag.id,
          { name, color, order: Math.max(0, Number(order) || 0) },
          tag.revision,
        );
        await onSaved();
      } else if (editor.type === "new-area") {
        await createLifeArea({ name, color });
        await onSaved();
      } else if (editor.type === "area" && area) {
        await updateLifeArea(
          area.id,
          { name, color, order: Math.max(0, Number(order) || 0) },
          area.revision,
        );
        await onSaved();
      }
    } catch (reason) {
      setLocalError(
        reason instanceof Error ? reason.message : "Could not save changes.",
      );
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    setBusy(true);
    try {
      if (editor.type === "collection" && collection)
        await setFolderArchived(
          collection.id,
          collection.archivedAtMs === undefined,
          collection.revision,
        );
      if (editor.type === "activity" && definition)
        await setActivityDefinitionArchived(
          definition.id,
          definition.archivedAtMs === undefined,
          definition.revision,
        );
      if (editor.type === "tag" && tag)
        await setOrganizerTagArchived(
          tag.id,
          tag.archivedAtMs === undefined,
          tag.revision,
        );
      if (editor.type === "area" && area)
        await setLifeAreaArchived(
          area.id,
          area.archivedAtMs === undefined,
          area.revision,
        );
      await onSaved();
    } catch (reason) {
      setLocalError(
        reason instanceof Error ? reason.message : "Could not archive item.",
      );
    } finally {
      setBusy(false);
    }
  };

  const supportsColor = true;
  const supportsList = [
    "new-task",
    "task",
    "new-activity",
    "activity",
  ].includes(editor.type);
  const supportsTags = supportsList;
  const supportsDuration = supportsList;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end bg-black/45 sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organizer-editor-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex min-h-11 items-center gap-2">
          <h2
            id="organizer-editor-title"
            className="min-w-0 flex-1 text-lg font-bold"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg border text-xl"
            aria-label="Close editor"
          >
            ×
          </button>
        </div>
        <label className="mt-2 block text-sm font-semibold">
          Name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3 text-base"
          />
        </label>
        {supportsColor && (
          <label className="mt-2 flex min-h-11 items-center gap-3 text-sm font-semibold">
            Color
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-11 w-16 rounded-lg border p-1"
            />
          </label>
        )}
        {(editor.type === "new-collection" || editor.type === "collection") && (
          <label className="mt-2 block text-sm font-semibold">
            Parent folder
            <select
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-2"
            >
              <option value="">Top level</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {supportsList && (
          <label className="mt-2 block text-sm font-semibold">
            List
            <select
              value={listId}
              onChange={(event) => setListId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-2"
            >
              <option value="">Inbox / no list</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {["new-activity", "activity"].includes(editor.type) && (
          <label className="mt-2 block text-sm font-semibold">
            Life Area
            <select
              value={lifeAreaId}
              onChange={(event) => setLifeAreaId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-2"
            >
              <option value="">No area</option>
              {snapshot.areas
                .filter((candidate) => candidate.archivedAtMs === undefined)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {["new-task", "task"].includes(editor.type) && (
          <label className="mt-2 block text-sm font-semibold">
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
            />
          </label>
        )}
        {editor.type === "task" && (
          <label className="mt-2 block text-sm font-semibold">
            Status
            <select
              value={taskStatus}
              onChange={(event) =>
                setTaskStatus(
                  event.target.value as TaskOccurrenceRecord["status"],
                )
              }
              className="mt-1 min-h-11 w-full rounded-lg border px-2"
            >
              <option value="inbox">Inbox</option>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="deferred">Deferred</option>
              <option value="missed">Missed</option>
            </select>
          </label>
        )}
        {supportsDuration && (
          <label className="mt-2 block text-sm font-semibold">
            Estimate (minutes)
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-3 text-base"
            />
          </label>
        )}
        {editor.type === "new-task" && (
          <label className="mt-2 flex min-h-11 items-center gap-2 rounded-lg bg-indigo-50 px-3 text-sm">
            <input
              type="checkbox"
              checked={reusable}
              onChange={(event) => setReusable(event.target.checked)}
            />
            Also save as reusable Activity
          </label>
        )}
        {supportsTags && snapshot.tags.length > 0 && (
          <fieldset className="mt-3">
            <legend className="text-sm font-semibold">Tags</legend>
            <div className="mt-1 flex max-h-36 flex-wrap gap-1 overflow-y-auto">
              {snapshot.tags
                .filter((candidate) => candidate.archivedAtMs === undefined)
                .map((candidate) => {
                  const selected = tagIds.includes(candidate.id);
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setTagIds((current) =>
                          selected
                            ? current.filter((id) => id !== candidate.id)
                            : [...current, candidate.id],
                        )
                      }
                      className={`min-h-10 rounded-full border px-3 text-xs font-semibold ${selected ? "bg-indigo-50 text-indigo-900" : ""}`}
                    >
                      <span
                        className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: candidate.color }}
                      />
                      #{candidate.name}
                    </button>
                  );
                })}
            </div>
          </fieldset>
        )}
        {supportsDuration && (
          <details className="mt-3 rounded-lg border bg-slate-50 p-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold">
              Timing &amp; planning
            </summary>
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Duration type
                <select
                  value={durationMode}
                  onChange={(event) =>
                    setDurationMode(event.target.value as "fixed" | "adaptive")
                  }
                  className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"
                >
                  <option value="fixed">Fixed</option>
                  <option value="adaptive">Adaptive</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Minimum minutes
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={minimumDuration}
                  onChange={(event) => setMinimumDuration(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"
                />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Scheduling
                <select
                  value={schedulingMode}
                  onChange={(event) =>
                    setSchedulingMode(
                      event.target.value as "flexible" | "exact" | "window",
                    )
                  }
                  className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"
                >
                  <option value="flexible">Flexible</option>
                  <option value="exact">Exact time</option>
                  <option value="window">Time window</option>
                </select>
              </label>
              {schedulingMode === "exact" && (
                <label className="text-sm font-semibold sm:col-span-2">
                  Start time
                  <input
                    type="time"
                    value={exactStart}
                    onChange={(event) => setExactStart(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"
                  />
                </label>
              )}
              {schedulingMode === "window" && (
                <>
                  <label className="text-sm font-semibold">
                    Window start
                    <input
                      type="time"
                      value={windowStart}
                      onChange={(event) => setWindowStart(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Window end
                    <input
                      type="time"
                      value={windowEnd}
                      onChange={(event) => setWindowEnd(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"
                    />
                  </label>
                </>
              )}
            </div>
          </details>
        )}
        {["new-activity", "activity"].includes(editor.type) && (
          <details className="mt-2 rounded-lg border bg-slate-50 p-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold">
              Recurrence &amp; priority
            </summary>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={protectedActivity}
                onChange={(event) => setProtectedActivity(event.target.checked)}
              />
              Protected / priority activity
            </label>
            <label className="mt-1 block text-sm font-semibold">
              Repeat
              <select
                value={recurrenceType}
                onChange={(event) =>
                  setRecurrenceType(
                    event.target.value as TaskRecurrenceRule["type"],
                  )
                }
                className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Selected weekdays</option>
                <option value="monthly">Monthly dates</option>
                <option value="yearly">Yearly dates</option>
                <option value="interval">Every N days</option>
              </select>
            </label>
            {!["none", "daily"].includes(recurrenceType) && (
              <label className="mt-2 block text-sm font-semibold">
                {recurrenceType === "weekdays"
                  ? "Weekdays (0 Sun – 6 Sat)"
                  : recurrenceType === "monthly"
                    ? "Dates (1–31)"
                    : recurrenceType === "yearly"
                      ? "Dates (MM-DD)"
                      : "Interval days"}
                <input
                  value={recurrenceValues}
                  onChange={(event) => setRecurrenceValues(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"
                  placeholder={
                    recurrenceType === "weekdays"
                      ? "1, 3, 5"
                      : recurrenceType === "monthly"
                        ? "1, 15"
                        : recurrenceType === "yearly"
                          ? "01-01, 12-25"
                          : "2"
                  }
                />
              </label>
            )}
            {recurrenceType !== "none" && (
              <label className="mt-2 block text-sm font-semibold">
                Missed occurrence
                <select
                  value={rolloverPolicy}
                  onChange={(event) =>
                    setRolloverPolicy(event.target.value as "carry" | "skip")
                  }
                  className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"
                >
                  <option value="carry">Carry forward</option>
                  <option value="skip">Skip</option>
                </select>
              </label>
            )}
          </details>
        )}
        {(["collection", "activity", "tag", "area"] as string[]).includes(
          editor.type,
        ) && (
          <label className="mt-2 block text-sm font-semibold">
            Order
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
            />
          </label>
        )}
        {localError && (
          <div
            role="alert"
            className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800"
          >
            {localError}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          {(["collection", "activity", "tag", "area"] as string[]).includes(
            editor.type,
          ) && (
            <button
              disabled={busy}
              onClick={() => void archive()}
              className="min-h-11 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-800"
            >
              {collection?.archivedAtMs ||
              definition?.archivedAtMs ||
              tag?.archivedAtMs ||
              area?.archivedAtMs
                ? "Restore"
                : "Archive"}
            </button>
          )}
          <button
            disabled={busy || !name.trim()}
            onClick={() => void save()}
            className="min-h-11 flex-1 rounded-lg bg-slate-950 px-4 font-bold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
