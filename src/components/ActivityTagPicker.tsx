import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  isTagAssigned,
  normalizeTagName,
  type CanonicalTag,
} from "../domain/tags";

export function ActivityTagPicker({
  open,
  activityName,
  assignedTags,
  tags,
  onToggle,
  onCreate,
  onClose,
}: {
  open: boolean;
  activityName: string;
  assignedTags: unknown;
  tags: readonly CanonicalTag[];
  onToggle: (tag: CanonicalTag, selected: boolean) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const normalizedQuery = normalizeTagName(query);
  const filtered = useMemo(
    () =>
      normalizedQuery
        ? tags.filter((tag) =>
            normalizeTagName(tag.name).includes(normalizedQuery),
          )
        : tags,
    [normalizedQuery, tags],
  );
  const canCreate =
    Boolean(normalizedQuery) &&
    !tags.some((tag) => normalizeTagName(tag.name) === normalizedQuery);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Tags for ${activityName}`}
        className="max-h-[min(78dvh,42rem)] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b px-3 py-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Tags</h2>
            <p className="truncate text-xs text-slate-500">{activityName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tag picker"
            className="min-h-11 min-w-11 rounded-lg text-xl text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            ×
          </button>
        </header>
        <div className="p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search or create tag"
            placeholder="Search or create a tag"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div className="max-h-[50dvh] overflow-y-auto px-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                onCreate(normalizedQuery);
                setQuery("");
              }}
              className="mb-2 flex min-h-11 w-full items-center rounded-lg border border-dashed border-indigo-300 px-3 text-left text-sm font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              + Create “{query.trim()}”
            </button>
          )}
          <div className="space-y-1" role="list" aria-label="Available tags">
            {filtered.map((tag) => {
              const selected = isTagAssigned(assignedTags, tag);
              return (
                <button
                  key={tag.key}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => onToggle(tag, !selected)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    selected
                      ? "bg-indigo-50 text-indigo-900"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  <span aria-hidden="true" className="text-lg">
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
            {!filtered.length && !canCreate && (
              <p className="py-6 text-center text-sm text-slate-500">
                No matching tags
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ActivityTagButton({
  activityName,
  assignedTags,
  tags,
  onClick,
}: {
  activityName: string;
  assignedTags: unknown;
  tags: readonly CanonicalTag[];
  onClick: () => void;
}) {
  const selected = tags.filter((tag) => isTagAssigned(assignedTags, tag));
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      aria-label={`Edit tags for ${activityName}`}
      className="flex min-h-11 min-w-11 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-2 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <span aria-hidden="true">🏷</span>
      {selected.length ? (
        <>
          {selected.slice(0, 2).map((tag) => (
            <span
              key={tag.key}
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: tag.color }}
              title={tag.name}
            />
          ))}
          <span>{selected.length}</span>
        </>
      ) : (
        <span>Tag</span>
      )}
    </button>
  );
}
