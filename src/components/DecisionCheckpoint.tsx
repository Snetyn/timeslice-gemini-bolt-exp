import { useEffect, useState } from "react";
import { listActivityDefinitions } from "../data/activityCatalogRepository";
import { getOrCreateDecisionOpportunity, listDecisionSuggestions } from "../data/decisionMomentumRepository";
import type { ActivityDefinitionRecord } from "../domain/activityCatalog";
import type { ActivitySessionSource } from "../domain/activitySession";
import type { DecisionInteraction, DecisionOpportunityRecord } from "../domain/decisionMomentum";

export type DecisionStart = {
  definition: ActivityDefinitionRecord;
  opportunity: DecisionOpportunityRecord;
  interaction: DecisionInteraction;
  reward: boolean;
};

export function DecisionCheckpoint({ open, reason = "manual", opportunitySourceKey = "idle", foregroundBackgroundMs = 0, currentSourceKeys, source: _source, onClose, onStart }: { open: boolean; reason?: "manual" | "after-activity" | "foreground"; opportunitySourceKey?: string; foregroundBackgroundMs?: number; currentSourceKeys: string[]; source: ActivitySessionSource; onClose: () => void; onStart: (choice: DecisionStart) => void }) {
  const [opportunity, setOpportunity] = useState<DecisionOpportunityRecord | null>(null);
  const [suggestions, setSuggestions] = useState<ActivityDefinitionRecord[]>([]);
  const [all, setAll] = useState<ActivityDefinitionRecord[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [leisure, setLeisure] = useState(false);
  const [distraction, setDistraction] = useState<ActivityDefinitionRecord | null>(null);
  const sourceKeySignature = currentSourceKeys.join("\u0000");
  useEffect(() => {
    if (!open) return;
    void Promise.all([
      getOrCreateDecisionOpportunity(reason, opportunitySourceKey, Date.now(), foregroundBackgroundMs),
      listDecisionSuggestions(currentSourceKeys),
      listActivityDefinitions(false),
    ]).then(([created, nextSuggestions, definitions]) => {
      setOpportunity(created.value);
      setSuggestions(nextSuggestions);
      setAll(definitions);
    });
  }, [foregroundBackgroundMs, open, opportunitySourceKey, reason, sourceKeySignature]);
  if (!open) return null;
  const start = (definition: ActivityDefinitionRecord, interaction: DecisionInteraction, reward: boolean) => {
    if (!opportunity) return;
    if (definition.decisionType === "distraction" && !distraction) { setDistraction(definition); return; }
    onStart({ definition, opportunity, interaction, reward });
    onClose();
  };
  return <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="decision-title"><div className="w-full max-w-md rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Decision checkpoint</div><h2 id="decision-title" className="text-xl font-bold">What are you choosing next?</h2></div><button onClick={onClose} className="min-h-11 min-w-11 rounded-lg text-xl" aria-label="Close">×</button></div>{opportunity && !opportunity.rewardable && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">You can still choose here. Momentum becomes available after 60 seconds of focused work or a fresh return after 15 minutes.</p>}{distraction ? <div className="mt-4"><p className="font-semibold">Is this intentional, or are you avoiding something?</p><p className="mt-1 text-sm text-slate-600">{distraction.name}</p><button onClick={() => start(distraction, "alternative", false)} className="mt-3 min-h-11 w-full rounded-lg border font-semibold">Intentional — continue</button><button onClick={() => { setDistraction(null); setChoosing(true); }} className="mt-2 min-h-11 w-full rounded-lg bg-slate-950 font-semibold text-white">Choose something else</button></div> : <><div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3">{suggestions[0] ? <><div className="text-xs text-indigo-700">Suggested</div><div className="mt-1 flex items-center gap-2 font-bold"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: suggestions[0].color }} />{suggestions[0].name}</div><button onClick={() => start(suggestions[0], "suggested", true)} className="mt-3 min-h-11 w-full rounded-lg bg-indigo-700 font-semibold text-white">Start suggested</button></> : <p className="text-sm text-slate-600">No eligible constructive activity is available yet.</p>}</div><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => { setChoosing(!choosing); setLeisure(false); }} className="min-h-11 rounded-lg border font-semibold">Choose another</button><button onClick={() => { setLeisure(!leisure); setChoosing(false); }} className="min-h-11 rounded-lg border font-semibold">Intentional leisure</button></div>{(choosing || leisure) && <div className="mt-3 max-h-52 space-y-1 overflow-y-auto">{all.filter((definition) => leisure ? definition.decisionType === "leisure" : definition.id !== suggestions[0]?.id).map((definition) => <button key={definition.id} onClick={() => start(definition, choosing ? "alternative" : "alternative", !leisure && definition.decisionType !== "distraction")} className="flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: definition.color }} /><span className="flex-1 font-medium">{definition.name}</span><span className="text-xs capitalize text-slate-500">{definition.decisionType}</span></button>)}</div>}</>}</div></div>;
}
