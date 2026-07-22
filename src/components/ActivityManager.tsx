import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adoptLegacyHistory,
  createFolder,
  createLifeArea,
  listActivityDefinitions,
  listFolders,
  listLifeAreas,
  previewLegacyHistoryCandidates,
  setActivityDefinitionArchived,
  setFolderArchived,
  setLifeAreaArchived,
  updateActivityDefinition,
  updateFolder,
  type LegacyHistoryCandidate,
} from "../data/activityCatalogRepository";
import { flattenFolderTree, type ActivityDefinitionRecord, type ActivityFolderRecord, type LifeAreaRecord } from "../domain/activityCatalog";
import { QuickCreateActivity } from "./QuickCreateActivity";

export function ActivityManager({ open, onClose, onOpenTimerLists }: { open: boolean; onClose: () => void; onOpenTimerLists: () => void }) {
  const [areas, setAreas] = useState<LifeAreaRecord[]>([]);
  const [folders, setFolders] = useState<ActivityFolderRecord[]>([]);
  const [definitions, setDefinitions] = useState<ActivityDefinitionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newArea, setNewArea] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<LegacyHistoryCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const refresh = useCallback(async () => {
    const [nextAreas, nextFolders, nextDefinitions] = await Promise.all([
      listLifeAreas(true), listFolders(true), listActivityDefinitions(true),
    ]);
    setAreas(nextAreas); setFolders(nextFolders); setDefinitions(nextDefinitions);
  }, []);
  useEffect(() => { if (open) void refresh(); }, [open, refresh]);
  const flatFolders = useMemo(() => flattenFolderTree(folders, true), [folders]);
  const effectiveArchivedFolders = useMemo(() => new Set(flatFolders.filter((folder) => folder.effectivelyArchived).map((folder) => folder.id)), [flatFolders]);
  const visibleDefinitions = useMemo(() => definitions.filter((definition) => {
    const archived = definition.archivedAtMs !== undefined || Boolean(definition.folderId && effectiveArchivedFolders.has(definition.folderId));
    return (showArchived || !archived) && definition.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [definitions, effectiveArchivedFolders, search, showArchived]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85] bg-white" role="dialog" aria-modal="true" aria-labelledby="activity-manager-title">
      <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col overflow-hidden">
        <header className="flex min-h-14 items-center justify-between border-b border-slate-200 px-3 pt-[env(safe-area-inset-top)]"><div><div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Reusable catalog</div><h2 id="activity-manager-title" className="text-xl font-bold">Areas & activities</h2></div><button onClick={onClose} className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-xl" aria-label="Close activity manager">×</button></header>
        <main className="flex-1 space-y-3 overflow-y-auto px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <QuickCreateActivity areas={areas} folders={folders} onComplete={() => void refresh()} />
          <section className="rounded-xl border border-slate-200 p-3"><div className="mb-2 flex items-center justify-between"><h3 className="font-bold">Life areas</h3><span className="text-xs text-slate-500">Historical snapshots stay unchanged</span></div><div className="flex gap-2"><input value={newArea} onChange={(event) => setNewArea(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border px-3" placeholder="New life area" /><button onClick={async () => { if (!newArea.trim()) return; await createLifeArea({ name: newArea, color: "#6366f1" }); setNewArea(""); await refresh(); }} className="min-h-11 rounded-lg border px-3 font-semibold">Add</button></div><div className="mt-2 flex flex-wrap gap-2">{areas.map((area) => <button key={area.id} onClick={async () => { await setLifeAreaArchived(area.id, area.archivedAtMs === undefined, area.revision); await refresh(); }} className={`min-h-11 rounded-full border px-3 text-sm ${area.archivedAtMs !== undefined ? "opacity-50" : ""}`} title={area.archivedAtMs === undefined ? "Archive area" : "Restore area"}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: area.color }} />{area.name}</button>)}</div></section>
          <section className="rounded-xl border border-slate-200 p-3"><h3 className="mb-2 font-bold">Folders</h3><div className="flex gap-2"><input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border px-3" placeholder="New folder" /><button onClick={async () => { if (!newFolder.trim()) return; await createFolder({ name: newFolder }); setNewFolder(""); await refresh(); }} className="min-h-11 rounded-lg border px-3 font-semibold">Add</button></div><div className="mt-2 space-y-1">{flatFolders.map((folder) => <div key={folder.id} className={`flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-2 ${folder.effectivelyArchived ? "opacity-50" : ""}`} style={{ paddingLeft: `${8 + folder.depth * 18}px` }}><span className="min-w-0 flex-1 truncate">▸ {folder.name}</span><button aria-label={`Move ${folder.name} up`} onClick={async () => { await updateFolder(folder.id, { order: Math.max(0, folder.order - 1) }, folder.revision); await refresh(); }} className="min-h-11 min-w-11">↑</button><button aria-label={folder.archivedAtMs === undefined ? `Archive ${folder.name}` : `Restore ${folder.name}`} onClick={async () => { await setFolderArchived(folder.id, folder.archivedAtMs === undefined, folder.revision); await refresh(); }} className="min-h-11 px-2 text-xs font-semibold">{folder.archivedAtMs === undefined ? "Archive" : "Restore"}</button></div>)}</div></section>
          <section className="rounded-xl border border-slate-200 p-3"><div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="mr-auto font-bold">Activities</h3><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Archived</label></div><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="mb-2 min-h-11 w-full rounded-lg border px-3" placeholder="Search activities" />
            <div className="space-y-2">{visibleDefinitions.map((definition) => <div key={definition.id} className="rounded-xl border border-slate-200 p-2"><div className="flex items-center gap-2"><input type="color" value={definition.color} aria-label={`${definition.name} color`} onChange={async (event) => { await updateActivityDefinition(definition.id, { color: event.target.value }, definition.revision); await refresh(); }} className="h-11 w-11 rounded p-1" /><input defaultValue={definition.name} aria-label={`${definition.name} name`} onBlur={async (event) => { if (event.target.value.trim() && event.target.value.trim() !== definition.name) { await updateActivityDefinition(definition.id, { name: event.target.value }, definition.revision); await refresh(); } }} className="min-h-11 min-w-0 flex-1 rounded-lg border px-2 font-semibold" /><button title="Priority & protected" aria-pressed={definition.protected} onClick={async () => { await updateActivityDefinition(definition.id, { protected: !definition.protected }, definition.revision); await refresh(); }} className={`min-h-11 min-w-11 text-xl ${definition.protected ? "text-amber-500" : "text-slate-400"}`}>★</button></div><div className="mt-2 grid grid-cols-2 gap-2"><select value={definition.lifeAreaId || ""} onChange={async (event) => { await updateActivityDefinition(definition.id, { lifeAreaId: event.target.value || null }, definition.revision); await refresh(); }} className="min-h-11 min-w-0 rounded-lg border px-2 text-sm"><option value="">Unassigned</option>{areas.filter((area) => area.archivedAtMs === undefined).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select><select value={definition.folderId || ""} onChange={async (event) => { await updateActivityDefinition(definition.id, { folderId: event.target.value || null }, definition.revision); await refresh(); }} className="min-h-11 min-w-0 rounded-lg border px-2 text-sm"><option value="">No folder</option>{flatFolders.filter((folder) => !folder.effectivelyArchived).map((folder) => <option key={folder.id} value={folder.id}>{" ".repeat(folder.depth)}{folder.name}</option>)}</select></div><div className="mt-2 flex gap-2"><select aria-label={`${definition.name} decision type`} value={definition.decisionType} onChange={async (event) => { await updateActivityDefinition(definition.id, { decisionType: event.target.value as ActivityDefinitionRecord["decisionType"] }, definition.revision); await refresh(); }} className="min-h-11 rounded-lg border px-2 text-sm"><option value="normal">Normal</option><option value="leisure">Leisure</option><option value="distraction">Distraction</option></select><button onClick={async () => { const next = await previewLegacyHistoryCandidates(definition.id); setHistoryFor(definition.id); setCandidates(next); setSelectedCandidates([]); }} className="min-h-11 rounded-lg border px-2 text-xs font-semibold">History matches</button><button onClick={async () => { await setActivityDefinitionArchived(definition.id, definition.archivedAtMs === undefined, definition.revision); await refresh(); }} className="ml-auto min-h-11 rounded-lg border px-2 text-xs font-semibold">{definition.archivedAtMs === undefined ? "Archive" : "Restore"}</button></div>
              {historyFor === definition.id && <div className="mt-2 rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-600">Select only source groups that truly belong to this activity. Name matches are suggestions, never automatic.</p>{candidates.length === 0 ? <p className="py-2 text-sm">No unassigned matches.</p> : candidates.map((candidate) => <label key={candidate.key} className="flex min-h-11 items-center gap-2 border-b text-xs"><input type="checkbox" checked={selectedCandidates.includes(candidate.key)} onChange={(event) => setSelectedCandidates((current) => event.target.checked ? [...current, candidate.key] : current.filter((key) => key !== candidate.key))} /><span className="min-w-0 flex-1"><strong>{candidate.activityName}</strong> · {candidate.source} · {candidate.count} records · {Math.round(candidate.durationMs / 60000)}m</span></label>)}{candidates.length > 0 && <button disabled={!selectedCandidates.length} onClick={async () => { await adoptLegacyHistory(definition.id, selectedCandidates); setHistoryFor(null); await refresh(); }} className="mt-2 min-h-11 w-full rounded-lg bg-slate-950 font-semibold text-white disabled:opacity-50">Classify selected history</button>}</div>}
            </div>)}</div>
          </section>
          <button onClick={onOpenTimerLists} className="min-h-11 w-full rounded-xl border border-slate-300 font-semibold text-slate-700">Timer lists, templates, tags & advanced setup</button>
        </main>
      </div>
    </div>
  );
}
