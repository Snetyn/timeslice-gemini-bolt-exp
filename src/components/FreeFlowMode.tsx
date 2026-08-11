import { useCallback, useEffect, useMemo, useState } from "react";
import {
  abandonFreeFlowRun,
  addFreeFlowNode,
  completeFreeFlowNode,
  completionBonusSeconds,
  createFreeFlowRun,
  elapsedFreeFlowNodeSeconds,
  freeFlowDepthFirst,
  nextFreeFlowAction,
  normalizeFreeFlowSettings,
  pauseFreeFlowRun,
  removeFreeFlowNode,
  moveFreeFlowNode,
  startFreeFlowNode,
  suggestActionClass,
  type ActionClass,
  type FreeFlowRewardMode,
  type FreeFlowRun,
} from "../domain/freeFlow";
import {
  getActiveFreeFlowRun,
  importLegacySingleState,
  listFreeFlowRuns,
  saveFreeFlowRun,
} from "../data/freeFlowRepository";
import {
  endActivitySession,
  listActivitySessions,
  switchActivitySession,
  correctActivitySessionClassification,
} from "../data/activitySessionRepository";
import { createActivityDefinition } from "../data/activityCatalogRepository";
import { useElapsedScheduler } from "../hooks/useElapsedScheduler";

type RewardResult = {
  quickBeforeSeconds: number;
  quickAfterSeconds: number;
  creditedSeconds: number;
  timeCreditedSeconds: number;
  bonusCreditedSeconds: number;
};

type FreeFlowModeProps = {
  settings: Record<string, unknown>;
  quickReserveSeconds: number;
  quickReserveCapSeconds: number;
  bankSeconds: number;
  onApplyReward: (
    focusedSeconds: number,
    bonusSeconds: number,
    mode: FreeFlowRewardMode,
  ) => RewardResult;
  onTakeRest: (
    durationSeconds: number,
    source?: "reserve" | "vault" | "combined",
  ) => void;
  onChooseNext?: () => void;
  startRequest?: {
    id: string;
    name: string;
    activityDefinitionId?: string;
    origin?: "free-flow" | "quick-action";
    fundingMode?: "current" | "vault" | "next" | "proportional";
    allowProtectedCurrent?: boolean;
    sessionCurrentActivityIndex?: number;
    momentum?: {
      opportunityId: string;
      activityDefinitionId: string;
      source: "free-flow" | "quick-action" | "single";
      interaction: "suggested" | "alternative" | "distraction-redirect";
    };
  } | null;
  onStartRequestHandled?: (id: string) => void;
  onActionFinished?: (input: {
    actionId: string;
    name: string;
    origin: "free-flow" | "quick-action" | "legacy-single";
    elapsedSeconds: number;
    fundingMode?: "current" | "vault" | "next" | "proportional";
    allowProtectedCurrent?: boolean;
    completed: boolean;
    actionClass?: ActionClass;
    sessionCurrentActivityIndex?: number;
  }) => { fundingTrace?: FreeFlowRun["nodes"][number]["fundingTrace"] } | void;
  onActiveChange?: (active: boolean) => void;
};

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const classMeta: Record<
  ActionClass,
  { label: string; color: string; icon: string }
> = {
  quick: { label: "Quick", color: "#10b981", icon: "⚡" },
  medium: { label: "Medium", color: "#3b82f6", icon: "◆" },
  hard: { label: "Hard", color: "#8b5cf6", icon: "★" },
};

export function FreeFlowMode({
  settings,
  quickReserveSeconds,
  quickReserveCapSeconds,
  bankSeconds,
  onApplyReward,
  onTakeRest,
  onChooseNext,
  startRequest,
  onStartRequestHandled,
  onActionFinished,
  onActiveChange,
}: FreeFlowModeProps) {
  const freeFlowSettings = useMemo(
    () => normalizeFreeFlowSettings(settings),
    [settings],
  );
  const [run, setRun] = useState<FreeFlowRun | null>(null);
  const [history, setHistory] = useState<FreeFlowRun[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [rootDraft, setRootDraft] = useState("");
  const [runNameDraft, setRunNameDraft] = useState("Free Flow");
  const [childTargetId, setChildTargetId] = useState<string | null>(null);
  const [childDraft, setChildDraft] = useState("");
  const [nodeMenuId, setNodeMenuId] = useState<string | null>(null);
  const [classification, setClassification] = useState<{
    nodeId: string;
    elapsedSeconds: number;
    suggested: ActionClass;
    selected: ActionClass;
  } | null>(null);
  const [saveReusableCandidate, setSaveReusableCandidate] = useState<{
    run: FreeFlowRun;
    nodeId: string;
  } | null>(null);
  const [nextSuggestionId, setNextSuggestionId] = useState<string | null>(null);
  const [restCheckpoint, setRestCheckpoint] = useState(false);
  const [error, setError] = useState("");

  const refreshHistory = useCallback(async () => {
    const runs = await listFreeFlowRuns();
    setHistory(
      runs.filter(
        (item) => item.status === "completed" || item.status === "abandoned",
      ),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let legacy: unknown = null;
        try {
          const saved = localStorage.getItem("timeSliceSingleActivityState");
          legacy = saved ? JSON.parse(saved) : null;
        } catch {
          legacy = null;
        }
        await importLegacySingleState(legacy, Date.now());
        const active = await getActiveFreeFlowRun();
        if (!cancelled) {
          setRun(active);
          if (active) setRunNameDraft(active.name);
          const activeNode = active?.nodes.find(
            (node) => node.id === active.activeNodeId,
          );
          if (active && activeNode) {
            const anchoredAtMs = Date.now();
            await endActivitySession(
              "single",
              "switched",
              anchoredAtMs,
              `free-flow:legacy-record-end:${active.id}`,
            );
            await switchActivitySession(
              `free-flow:${active.id}`,
              {
                activityId: activeNode.id,
                activityName: activeNode.name,
                source: "free-flow",
                kind: "standard",
                activityDefinitionId: activeNode.activityDefinitionId,
                freeFlowRunId: active.id,
                actionId: activeNode.id,
                actionOrigin: active.origin,
              },
              anchoredAtMs,
              `free-flow:restore-record:${active.id}`,
            );
          }
          await refreshHistory();
        }
      } catch (reason) {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Free Flow could not be loaded.",
          );
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshHistory]);

  useElapsedScheduler({
    enabled: Boolean(run?.activeNodeId),
    onElapsed: () => setNowMs(Date.now()),
  });
  useEffect(() => {
    onActiveChange?.(Boolean(run?.activeNodeId));
    return () => onActiveChange?.(false);
  }, [onActiveChange, run?.activeNodeId]);

  const persist = useCallback(
    async (next: FreeFlowRun, mutationId?: string) => {
      setRun(next);
      try {
        const saved = await saveFreeFlowRun(next, mutationId);
        setRun(saved.value);
        if (
          saved.value.status === "completed" ||
          saved.value.status === "abandoned"
        ) {
          await refreshHistory();
        }
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Free Flow could not be saved.",
        );
      }
    },
    [refreshHistory],
  );

  const ensureRun = () => {
    if (run) return run;
    const created = createFreeFlowRun(Date.now(), { name: runNameDraft });
    setRun(created);
    return created;
  };

  const addRoot = (kind: "action" | "group" = "action") => {
    if (!rootDraft.trim()) return;
    const base = ensureRun();
    const next = addFreeFlowNode(base, { name: rootDraft, kind }, Date.now());
    setRootDraft("");
    void persist(next);
  };

  const addChild = () => {
    if (!run || !childTargetId || !childDraft.trim()) return;
    const next = addFreeFlowNode(
      run,
      { name: childDraft, parentId: childTargetId },
      Date.now(),
    );
    setChildDraft("");
    setChildTargetId(null);
    void persist(next);
  };

  const startNode = async (nodeId: string) => {
    if (!run) return;
    const now = Date.now();
    if (run.activeNodeId && run.activeNodeId !== nodeId) {
      await endActivitySession(`free-flow:${run.id}`, "switched", now);
    }
    const next = startFreeFlowNode(run, nodeId, now);
    const node = next.nodes.find((item) => item.id === nodeId)!;
    setNowMs(now);
    setNextSuggestionId(null);
    await persist(next, `free-flow:start:${run.id}:${nodeId}:${now}`);
    await switchActivitySession(
      `free-flow:${run.id}`,
      {
        activityId: node.id,
        activityName: node.name,
        source:
          (node.actionOrigin || run.origin) === "quick-action"
            ? "quick-action"
            : "free-flow",
        kind: "standard",
        activityDefinitionId: node.activityDefinitionId,
        freeFlowRunId: run.id,
        actionId: node.id,
        actionOrigin: node.actionOrigin || run.origin,
      },
      now,
      `free-flow:record-start:${run.id}:${nodeId}:${now}`,
    );
  };

  useEffect(() => {
    if (!hydrated || !startRequest) return;
    onStartRequestHandled?.(startRequest.id);
    let cancelled = false;
    void (async () => {
      try {
        let base = run;
        if (
          !base ||
          base.status === "completed" ||
          base.status === "abandoned"
        ) {
          base = createFreeFlowRun(Date.now(), {
            name:
              startRequest.origin === "quick-action"
                ? "Quick Action"
                : "Free Flow",
            origin: startRequest.origin || "free-flow",
          });
        }
        let next = addFreeFlowNode(
          base,
          { name: startRequest.name },
          Date.now(),
        );
        const added = next.nodes.at(-1)!;
        if (startRequest.activityDefinitionId) {
          next = {
            ...next,
            nodes: next.nodes.map((node) =>
              node.id === added.id
                ? {
                    ...node,
                    activityDefinitionId: startRequest.activityDefinitionId,
                  }
                : node,
            ),
          };
        }
        if (startRequest.fundingMode) {
          next = {
            ...next,
            nodes: next.nodes.map((node) =>
              node.id === added.id
                ? {
                    ...node,
                    fundingMode: startRequest.fundingMode,
                    allowProtectedCurrent: Boolean(
                      startRequest.allowProtectedCurrent,
                    ),
                    sessionCurrentActivityIndex:
                      startRequest.sessionCurrentActivityIndex,
                    actionOrigin: startRequest.origin || "free-flow",
                  }
                : node,
            ),
          };
        }
        next = startFreeFlowNode(next, added.id, Date.now());
        if (cancelled) return;
        await persist(next, `free-flow:external-start:${startRequest.id}`);
        await switchActivitySession(
          `free-flow:${next.id}`,
          {
            activityId: added.id,
            activityName: added.name,
            source:
              startRequest.origin === "quick-action"
                ? "quick-action"
                : "free-flow",
            kind: "standard",
            activityDefinitionId: startRequest.activityDefinitionId,
            freeFlowRunId: next.id,
            actionId: added.id,
            actionOrigin: startRequest.origin || "free-flow",
          },
          Date.now(),
          `free-flow:external-record:${startRequest.id}`,
          startRequest.momentum,
        );
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Action could not be started.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, onStartRequestHandled, persist, run, startRequest]);

  const pause = async () => {
    if (!run?.activeNodeId) return;
    const now = Date.now();
    const next = pauseFreeFlowRun(run, now);
    await persist(next, `free-flow:pause:${run.id}:${now}`);
    await endActivitySession(
      `free-flow:${run.id}`,
      "paused",
      now,
      `free-flow:record-pause:${run.id}:${now}`,
    );
  };

  useEffect(() => {
    const handleRestStart = () => {
      if (!run?.activeNodeId) return;
      const now = Date.now();
      const next = {
        ...pauseFreeFlowRun(run, now),
        chainCount: 0,
      };
      void persist(next, `free-flow:rest-pause:${run.id}:${now}`);
      void endActivitySession(
        `free-flow:${run.id}`,
        "flow-break",
        now,
        `free-flow:rest-record:${run.id}:${now}`,
      );
    };
    window.addEventListener("timeslice:flow-rest-start", handleRestStart);
    return () =>
      window.removeEventListener("timeslice:flow-rest-start", handleRestStart);
  }, [persist, run]);

  const requestComplete = () => {
    if (!run?.activeNodeId) return;
    const node = run.nodes.find((item) => item.id === run.activeNodeId);
    if (!node) return;
    const elapsedSeconds = elapsedFreeFlowNodeSeconds(node, Date.now());
    const suggested = suggestActionClass(elapsedSeconds, freeFlowSettings);
    setClassification({
      nodeId: node.id,
      elapsedSeconds,
      suggested,
      selected: suggested,
    });
  };

  const confirmComplete = async () => {
    if (!run || !classification) return;
    const now = Date.now();
    const bonus =
      freeFlowSettings.rewardMode === "time"
        ? 0
        : completionBonusSeconds(classification.selected, run.chainCount);
    const reward = onApplyReward(
      classification.elapsedSeconds,
      bonus,
      freeFlowSettings.rewardMode,
    );
    const completed = completeFreeFlowNode(run, {
      nodeId: classification.nodeId,
      actionClass: classification.selected,
      atMs: now,
      quickReserveBeforeSeconds: reward.quickBeforeSeconds,
      quickReserveAfterSeconds: reward.quickAfterSeconds,
      quickReserveCapSeconds,
      bonusSecondsOverride: reward.bonusCreditedSeconds,
      classificationSettings: freeFlowSettings,
    });
    const funding = onActionFinished?.({
      actionId: classification.nodeId,
      name: completed.completedNode.name,
      origin: completed.completedNode.actionOrigin || run.origin,
      elapsedSeconds: classification.elapsedSeconds,
      fundingMode: completed.completedNode.fundingMode,
      allowProtectedCurrent: Boolean(
        completed.completedNode.allowProtectedCurrent,
      ),
      completed: true,
      actionClass: classification.selected,
      sessionCurrentActivityIndex:
        completed.completedNode.sessionCurrentActivityIndex,
    });
    const fundingTrace =
      funding && "fundingTrace" in funding ? funding.fundingTrace : undefined;
    if (fundingTrace?.length) {
      completed.run.nodes = completed.run.nodes.map((node) =>
        node.id === classification.nodeId ? { ...node, fundingTrace } : node,
      );
    }
    completed.run.rewardEarnedSeconds += reward.timeCreditedSeconds;
    await endActivitySession(
      `free-flow:${run.id}`,
      "completed",
      now,
      `free-flow:record-complete:${run.id}:${classification.nodeId}:${now}`,
    );
    await persist(
      completed.run,
      `free-flow:complete:${run.id}:${classification.nodeId}:${now}`,
    );
    setClassification(null);
    setSaveReusableCandidate({
      run: completed.run,
      nodeId: classification.nodeId,
    });
    setRestCheckpoint(completed.restCheckpoint);
    const completedOrigin = completed.completedNode.actionOrigin || run.origin;
    setNextSuggestionId(
      completedOrigin === "quick-action"
        ? null
        : nextFreeFlowAction(completed.run.nodes, classification.nodeId)?.id ||
            null,
    );
    if (completedOrigin === "quick-action") {
      if (run.origin === "quick-action") setRun(null);
      onChooseNext?.();
    } else if (completed.run.status === "completed") {
      setRun(null);
    }
  };

  const stopIncomplete = async () => {
    if (!run?.activeNodeId) return;
    const now = Date.now();
    const activeId = run.activeNodeId;
    const paused = pauseFreeFlowRun(run, now);
    const stoppedNode = paused.nodes.find((node) => node.id === activeId);
    const funding = onActionFinished?.({
      actionId: activeId,
      name: stoppedNode?.name || "Quick Action",
      origin: stoppedNode?.actionOrigin || run.origin,
      elapsedSeconds: stoppedNode?.accumulatedSeconds || 0,
      fundingMode: stoppedNode?.fundingMode,
      completed: false,
      sessionCurrentActivityIndex: stoppedNode?.sessionCurrentActivityIndex,
    });
    const stoppedFundingTrace =
      funding && "fundingTrace" in funding ? funding.fundingTrace : undefined;
    const next: FreeFlowRun = {
      ...paused,
      chainCount: 0,
      nodes: paused.nodes.map((node) =>
        node.id === activeId
          ? {
              ...node,
              status: "stopped",
              fundingTrace: stoppedFundingTrace || node.fundingTrace,
            }
          : node,
      ),
    };
    await persist(next, `free-flow:stop:${run.id}:${activeId}:${now}`);
    await endActivitySession(
      `free-flow:${run.id}`,
      "cancelled",
      now,
      `free-flow:record-stop:${run.id}:${activeId}:${now}`,
    );
    onChooseNext?.();
  };

  const saveReusable = async () => {
    if (!saveReusableCandidate) return;
    const candidateRun = saveReusableCandidate.run;
    const node = candidateRun.nodes.find(
      (item) => item.id === saveReusableCandidate.nodeId,
    );
    if (!node || node.activityDefinitionId) {
      setSaveReusableCandidate(null);
      return;
    }
    try {
      const created = await createActivityDefinition({
        name: node.name,
        color: "#3b82f6",
        baselineDurationSeconds: Math.max(60, node.accumulatedSeconds),
      });
      const next = {
        ...candidateRun,
        nodes: candidateRun.nodes.map((item) =>
          item.id === node.id
            ? { ...item, activityDefinitionId: created.value.id }
            : item,
        ),
        updatedAtMs: Date.now(),
      };
      if (
        run?.id === next.id &&
        (next.status === "active" || next.status === "draft")
      ) {
        await persist(next);
      } else {
        await saveFreeFlowRun(
          next,
          `free-flow:save-reusable:${next.id}:${node.id}`,
        );
        await refreshHistory();
      }
      const records = await listActivitySessions({ includeDeleted: false });
      const matching = records.find(
        (record) =>
          record.actionId === node.id && record.status === "completed",
      );
      if (matching) {
        await correctActivitySessionClassification(
          matching.id,
          created.value.id,
          matching.revision,
        );
      }
      setSaveReusableCandidate(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Activity could not be saved.",
      );
    }
  };

  const endRun = async () => {
    if (!run) return;
    const unfinished = run.nodes.some(
      (node) => node.kind === "action" && node.status !== "completed",
    );
    if (
      unfinished &&
      !window.confirm(
        "End this run as abandoned? Unfinished actions cannot be resumed.",
      )
    )
      return;
    const now = Date.now();
    const next = unfinished
      ? abandonFreeFlowRun(run, now)
      : {
          ...run,
          status: "completed" as const,
          endedAtMs: now,
          activeNodeId: null,
        };
    await endActivitySession(`free-flow:${run.id}`, "exited", now);
    await persist(next, `free-flow:end:${run.id}:${now}`);
    setRun(null);
    setNextSuggestionId(null);
  };

  const beginRest = () => {
    const duration = Math.max(
      0,
      Math.min(
        quickReserveSeconds,
        quickReserveCapSeconds || quickReserveSeconds,
      ),
    );
    if (duration <= 0) return;
    onTakeRest(duration, "reserve");
    if (run)
      void persist({
        ...run,
        chainCount: 0,
        restCheckpointDismissed: false,
        updatedAtMs: Date.now(),
      });
    setRestCheckpoint(false);
  };

  const summary = useMemo(() => {
    const actions = run?.nodes.filter((node) => node.kind === "action") || [];
    return {
      total: actions.length,
      completed: actions.filter((node) => node.status === "completed").length,
      focused: actions.reduce(
        (sum, node) => sum + elapsedFreeFlowNodeSeconds(node, nowMs),
        0,
      ),
    };
  }, [run, nowMs]);

  if (!hydrated) {
    return (
      <div className="rounded-xl border bg-white p-4 text-sm text-slate-500">
        Loading Free Flow…
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-3" aria-label="Free Flow">
      <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Free Flow</h2>
            <p className="text-xs text-slate-600">
              Choose quickly, finish honestly, rest when it helps.
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>
              Quick{" "}
              <strong className="tabular-nums text-emerald-700">
                {formatDuration(quickReserveSeconds)}
              </strong>
            </div>
            <div>
              Bank{" "}
              <strong className="tabular-nums text-violet-700">
                {formatDuration(bankSeconds)}
              </strong>
            </div>
          </div>
        </div>
        {run && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white p-2">
              <strong className="block text-base">{run.chainCount}</strong>chain
            </div>
            <div className="rounded-lg bg-white p-2">
              <strong className="block text-base">
                {summary.completed}/{summary.total}
              </strong>
              done
            </div>
            <div className="rounded-lg bg-white p-2">
              <strong className="block text-base tabular-nums">
                {formatDuration(summary.focused)}
              </strong>
              focused
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button
            className="min-h-11 px-3 font-semibold"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {!run ? (
        <div className="space-y-3 rounded-xl border bg-white p-3">
          <label className="block text-sm font-semibold">New run</label>
          <input
            className="min-h-11 w-full rounded-lg border px-3 text-base"
            value={runNameDraft}
            onChange={(event) => setRunNameDraft(event.target.value)}
            placeholder="Run name"
          />
          <button
            className="min-h-11 w-full rounded-lg bg-slate-900 px-4 font-semibold text-white"
            onClick={() =>
              void persist(
                createFreeFlowRun(Date.now(), { name: runNameDraft }),
              )
            }
          >
            Start blank run
          </button>
          {history.length > 0 && (
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer font-semibold">
                Recent runs ({history.length})
              </summary>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {history.slice(0, 12).map((item) => {
                  const actions = item.nodes.filter(
                    (node) => node.kind === "action",
                  );
                  const totalFocused = actions.reduce(
                    (sum, node) => sum + node.accumulatedSeconds,
                    0,
                  );
                  const classCounts = actions.reduce(
                    (counts, node) => {
                      if (node.actionClass) counts[node.actionClass] += 1;
                      return counts;
                    },
                    { quick: 0, medium: 0, hard: 0 },
                  );
                  const unfinished = actions.filter(
                    (node) => node.status !== "completed",
                  ).length;
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg bg-slate-50 p-2 text-sm"
                    >
                      <div className="flex justify-between gap-2">
                        <strong>{item.name}</strong>
                        <span
                          className={
                            item.status === "abandoned"
                              ? "text-amber-700"
                              : "text-emerald-700"
                          }
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        {
                          actions.filter((node) => node.status === "completed")
                            .length
                        }
                        /{actions.length} actions ·{" "}
                        {formatDuration(totalFocused)} focused · best chain{" "}
                        {item.longestChain} ·{" "}
                        {formatDuration(item.rewardEarnedSeconds)} reward
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Q {classCounts.quick} · M {classCounts.medium} · H{" "}
                        {classCounts.hard}
                        {unfinished > 0 ? ` · ${unfinished} unfinished` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      ) : (
        <>
          {run.activeNodeId &&
            (() => {
              const active = run.nodes.find(
                (node) => node.id === run.activeNodeId,
              );
              if (!active) return null;
              return (
                <div className="rounded-xl border-2 border-violet-300 bg-white p-4 text-center shadow-sm">
                  <div className="text-sm font-semibold text-violet-700">
                    Current action
                  </div>
                  <div className="mt-1 break-words text-xl font-bold">
                    {active.name}
                  </div>
                  <div
                    className="my-3 font-mono text-5xl tabular-nums text-slate-900"
                    aria-label="Free Flow elapsed time"
                  >
                    {formatDuration(elapsedFreeFlowNodeSeconds(active, nowMs))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="min-h-11 rounded-lg border font-semibold"
                      onClick={() => void pause()}
                    >
                      Pause
                    </button>
                    <button
                      className="min-h-11 rounded-lg bg-emerald-600 px-2 font-semibold text-white"
                      onClick={requestComplete}
                    >
                      Complete
                    </button>
                    <button
                      className="min-h-11 rounded-lg border border-red-200 px-2 font-semibold text-red-700"
                      onClick={() => void stopIncomplete()}
                    >
                      Stop
                    </button>
                  </div>
                </div>
              );
            })()}

          <div className="rounded-xl border bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-bold">{run.name}</h3>
                <div className="text-xs text-slate-500">
                  Groups organize; leaf actions are timed.
                </div>
              </div>
              <button
                className="min-h-11 rounded-lg border px-3 text-sm font-semibold text-red-700"
                onClick={() => void endRun()}
              >
                End run
              </button>
            </div>

            <div className="space-y-1">
              {freeFlowDepthFirst(run.nodes).map(({ node, depth }) => {
                const meta = node.actionClass
                  ? classMeta[node.actionClass]
                  : null;
                const effectiveDepth = Math.min(depth, 3);
                return (
                  <div key={node.id}>
                    <div
                      className={`flex min-h-12 items-center gap-2 rounded-lg border px-2 ${node.status === "completed" ? "bg-slate-50 opacity-60" : node.status === "active" ? "border-violet-400 bg-violet-50" : "bg-white"}`}
                      style={{ marginLeft: `${effectiveDepth * 12}px` }}
                    >
                      <span
                        className="w-5 shrink-0 text-center"
                        aria-hidden="true"
                      >
                        {node.kind === "group"
                          ? node.status === "completed"
                            ? "✓"
                            : "▾"
                          : meta?.icon || "○"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`break-words text-sm font-semibold ${node.status === "completed" ? "line-through" : ""}`}
                        >
                          {node.name}
                        </div>
                        {depth > 3 && (
                          <div className="text-[10px] text-slate-500">
                            Depth {depth + 1}
                          </div>
                        )}
                      </div>
                      {node.kind === "action" &&
                        node.accumulatedSeconds > 0 && (
                          <span
                            className="shrink-0 text-xs tabular-nums text-slate-600"
                            aria-label={
                              node.status === "active"
                                ? undefined
                                : "Free Flow elapsed time"
                            }
                          >
                            {formatDuration(
                              elapsedFreeFlowNodeSeconds(node, nowMs),
                            )}
                          </span>
                        )}
                      {node.kind === "action" &&
                        node.status !== "completed" &&
                        node.status !== "active" && (
                          <button
                            className="min-h-11 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
                            onClick={() => void startNode(node.id)}
                          >
                            {node.accumulatedSeconds > 0 ? "Resume" : "Start"}
                          </button>
                        )}
                      {node.status !== "completed" && (
                        <button
                          className="min-h-11 min-w-11 rounded-lg border text-lg"
                          aria-label={`Add child to ${node.name}`}
                          onClick={() => {
                            setChildTargetId(node.id);
                            setChildDraft("");
                          }}
                        >
                          +
                        </button>
                      )}
                      {node.status !== "active" && (
                        <button
                          className="min-h-11 min-w-11 rounded-lg border text-lg"
                          aria-label={`Actions for ${node.name}`}
                          aria-expanded={nodeMenuId === node.id}
                          onClick={() =>
                            setNodeMenuId((current) =>
                              current === node.id ? null : node.id,
                            )
                          }
                        >
                          ⋯
                        </button>
                      )}
                    </div>
                    {nodeMenuId === node.id && (
                      <div
                        className="ml-4 mt-1 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2"
                        style={{
                          marginLeft: `${Math.min(depth, 3) * 12 + 12}px`,
                        }}
                      >
                        <button
                          className="min-h-11 rounded-lg border bg-white text-sm font-semibold"
                          onClick={() => {
                            void persist(moveFreeFlowNode(run, node.id, -1));
                            setNodeMenuId(null);
                          }}
                        >
                          ↑ Up
                        </button>
                        <button
                          className="min-h-11 rounded-lg border bg-white text-sm font-semibold"
                          onClick={() => {
                            void persist(moveFreeFlowNode(run, node.id, 1));
                            setNodeMenuId(null);
                          }}
                        >
                          ↓ Down
                        </button>
                        <button
                          className="min-h-11 rounded-lg border border-red-200 bg-white text-sm font-semibold text-red-700"
                          onClick={() => {
                            if (
                              node.kind === "group" &&
                              !window.confirm(
                                `Delete ${node.name} and all actions inside it?`,
                              )
                            )
                              return;
                            void persist(removeFreeFlowNode(run, node.id));
                            setNodeMenuId(null);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {childTargetId === node.id && (
                      <div className="ml-6 mt-1 flex gap-2 rounded-lg bg-slate-50 p-2">
                        <input
                          autoFocus
                          className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"
                          value={childDraft}
                          onChange={(event) =>
                            setChildDraft(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") addChild();
                          }}
                          placeholder="Sub-action"
                        />
                        <button
                          className="min-h-11 rounded-lg bg-blue-600 px-3 font-semibold text-white"
                          onClick={addChild}
                        >
                          Add
                        </button>
                        <button
                          className="min-h-11 rounded-lg border px-3"
                          onClick={() => setChildTargetId(null)}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"
                value={rootDraft}
                onChange={(event) => setRootDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addRoot("action");
                }}
                placeholder="Add an action…"
              />
              <button
                className="min-h-11 rounded-lg bg-blue-600 px-3 font-semibold text-white"
                onClick={() => addRoot("action")}
              >
                Add
              </button>
              <button
                className="min-h-11 rounded-lg border px-3 text-sm font-semibold"
                onClick={() => addRoot("group")}
              >
                Group
              </button>
            </div>
          </div>
        </>
      )}

      {classification && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-flow-complete-title"
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-2xl">
            <h3 id="free-flow-complete-title" className="text-lg font-bold">
              How did that action feel?
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Focused {formatDuration(classification.elapsedSeconds)} ·
              suggested {classMeta[classification.suggested].label}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(Object.keys(classMeta) as ActionClass[]).map((value) => (
                <button
                  key={value}
                  aria-pressed={classification.selected === value}
                  className={`min-h-14 rounded-xl border-2 px-2 font-semibold ${classification.selected === value ? "text-white" : "bg-white"}`}
                  style={
                    classification.selected === value
                      ? {
                          backgroundColor: classMeta[value].color,
                          borderColor: classMeta[value].color,
                        }
                      : {
                          borderColor: classMeta[value].color,
                          color: classMeta[value].color,
                        }
                  }
                  onClick={() =>
                    setClassification((current) =>
                      current ? { ...current, selected: value } : current,
                    )
                  }
                >
                  {classMeta[value].icon}
                  <span className="ml-1">{classMeta[value].label}</span>
                </button>
              ))}
            </div>
            <button
              className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 font-bold text-white"
              onClick={() => void confirmComplete()}
            >
              Confirm completion
            </button>
            <button
              className="mt-2 min-h-11 w-full rounded-xl border"
              onClick={() => setClassification(null)}
            >
              Keep timing
            </button>
          </div>
        </div>
      )}

      {restCheckpoint && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rest-checkpoint-title"
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-2xl">
            <h3 id="rest-checkpoint-title" className="text-lg font-bold">
              Quick Reserve is full
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              You earned a real stopping point. Rest is available, never
              required.
            </p>
            <button
              className="mt-4 min-h-12 w-full rounded-xl bg-emerald-600 font-bold text-white"
              onClick={beginRest}
            >
              Rest{" "}
              {formatDuration(
                Math.min(quickReserveSeconds, quickReserveCapSeconds),
              )}
            </button>
            <button
              className="mt-2 min-h-11 w-full rounded-xl border"
              onClick={() => {
                setRestCheckpoint(false);
                if (run)
                  void persist({
                    ...run,
                    restCheckpointDismissed: true,
                    updatedAtMs: Date.now(),
                  });
              }}
            >
              Continue flow
            </button>
          </div>
        </div>
      )}

      {nextSuggestionId && !restCheckpoint && run && (
        <div className="sticky bottom-2 z-10 rounded-xl border border-blue-200 bg-white p-3 shadow-lg">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Suggested next
          </div>
          <div className="mt-1 font-bold">
            {run.nodes.find((node) => node.id === nextSuggestionId)?.name}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="min-h-11 rounded-lg bg-blue-600 font-semibold text-white"
              onClick={() => void startNode(nextSuggestionId)}
            >
              Start next
            </button>
            <button
              className="min-h-11 rounded-lg border font-semibold"
              onClick={() => {
                setNextSuggestionId(null);
                onChooseNext?.();
              }}
            >
              Choose another
            </button>
          </div>
        </div>
      )}

      {saveReusableCandidate && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="font-semibold">
            Save “
            {
              saveReusableCandidate.run.nodes.find(
                (node) => node.id === saveReusableCandidate.nodeId,
              )?.name
            }
            ” as a reusable activity?
          </div>
          <div className="mt-2 flex gap-2">
            <button
              className="min-h-11 rounded-lg bg-emerald-700 px-4 font-semibold text-white"
              onClick={() => void saveReusable()}
            >
              Save activity
            </button>
            <button
              className="min-h-11 rounded-lg border px-4"
              onClick={() => setSaveReusableCandidate(null)}
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
