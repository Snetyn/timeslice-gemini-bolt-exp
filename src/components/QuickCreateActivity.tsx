import { useMemo, useState } from "react";
import {
  createActivityDefinition,
  findDefinitionsByName,
} from "../data/activityCatalogRepository";
import type {
  ActivityDefinitionRecord,
  ActivityFolderRecord,
  LifeAreaRecord,
} from "../domain/activityCatalog";

export function QuickCreateActivity({
  areas,
  folders,
  onComplete,
}: {
  areas: LifeAreaRecord[];
  folders: ActivityFolderRecord[];
  onComplete: (definition: ActivityDefinitionRecord, reused: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [lifeAreaId, setLifeAreaId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [matches, setMatches] = useState<ActivityDefinitionRecord[]>([]);
  const [checking, setChecking] = useState(false);
  const activeFolders = useMemo(
    () => folders.filter((folder) => folder.archivedAtMs === undefined),
    [folders],
  );

  const createSeparate = async () => {
    const result = await createActivityDefinition({
      name,
      color,
      lifeAreaId: lifeAreaId || null,
      folderId: folderId || null,
    });
    setName("");
    setMatches([]);
    onComplete(result.value, false);
  };

  const submit = async () => {
    if (!name.trim()) return;
    setChecking(true);
    try {
      const found = (await findDefinitionsByName(name)).filter(
        (definition) => definition.archivedAtMs === undefined,
      );
      if (found.length) setMatches(found);
      else await createSeparate();
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
      <h3 className="mb-2 font-bold text-slate-900">Quick create</h3>
      <label className="block text-xs font-medium text-slate-600" htmlFor="quick-activity-name">Activity name</label>
      <div className="mt-1 flex gap-2">
        <input id="quick-activity-name" value={name} onChange={(event) => { setName(event.target.value); setMatches([]); }} onKeyDown={(event) => event.key === "Enter" && void submit()} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3" placeholder="What will you do?" />
        <button disabled={!name.trim() || checking} onClick={() => void submit()} className="min-h-11 rounded-lg bg-slate-950 px-4 font-semibold text-white disabled:opacity-50">Add</button>
      </div>
      <div className="mt-2 grid grid-cols-[44px_1fr_1fr] gap-2">
        <input aria-label="Activity color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-11 w-11 rounded-lg border border-slate-300 bg-white p-1" />
        <select aria-label="Life area" value={lifeAreaId} onChange={(event) => setLifeAreaId(event.target.value)} className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm"><option value="">No area</option>{areas.filter((area) => area.archivedAtMs === undefined).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
        <select aria-label="Folder" value={folderId} onChange={(event) => setFolderId(event.target.value)} className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm"><option value="">No folder</option>{activeFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
      </div>
      {matches.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-white p-2" role="group" aria-label="Same-name activities">
          <p className="mb-2 text-sm font-semibold text-slate-800">Reuse existing or create a separate activity?</p>
          <div className="space-y-2">
            {matches.map((match) => (
              <button key={match.id} onClick={() => { setName(""); setMatches([]); onComplete(match, true); }} className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 text-left text-sm">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: match.color }} />
                <span className="min-w-0 flex-1"><strong className="block truncate">{match.name}</strong><span className="text-xs text-slate-500">{areas.find((area) => area.id === match.lifeAreaId)?.name || "No area"} · {folders.find((folder) => folder.id === match.folderId)?.name || "No folder"}</span></span>
                <span className="font-semibold text-indigo-700">Reuse</span>
              </button>
            ))}
          </div>
          <button onClick={() => void createSeparate()} className="mt-2 min-h-11 w-full rounded-lg border border-indigo-200 font-semibold text-indigo-700">Create separate “{name.trim()}”</button>
        </div>
      )}
      <details className="mt-2 text-sm text-slate-600"><summary className="min-h-11 cursor-pointer py-3 font-medium">Advanced timer options</summary><p className="pb-2 text-xs">Duration, count-up, scheduling, tags and categories remain available when the activity is added to a Session or Daily list.</p></details>
    </section>
  );
}
