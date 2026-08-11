export type ActionClass = "quick" | "medium" | "hard";
export type FreeFlowRewardMode = "time" | "hybrid" | "completion";
export type QuickActionFundingMode =
  "current" | "vault" | "next" | "proportional";

export type FreeFlowRunStatus = "draft" | "active" | "completed" | "abandoned";
export type FreeFlowNodeStatus = "pending" | "active" | "completed" | "stopped";

export type SessionFundingEntry = {
  activityId: string;
  seconds: number;
  offsetSeconds: number;
};

export type FreeFlowNode = {
  id: string;
  parentId?: string;
  name: string;
  order: number;
  kind: "group" | "action";
  status: FreeFlowNodeStatus;
  accumulatedSeconds: number;
  startedAtMs: number | null;
  activityDefinitionId?: string;
  suggestedClass?: ActionClass;
  actionClass?: ActionClass;
  completedAtMs?: number;
  rewardSeconds: number;
  fundingMode?: QuickActionFundingMode;
  allowProtectedCurrent?: boolean;
  sessionCurrentActivityIndex?: number;
  actionOrigin?: "free-flow" | "quick-action" | "legacy-single";
  fundingTrace: SessionFundingEntry[];
};

export type FreeFlowRun = {
  id: string;
  status: FreeFlowRunStatus;
  name: string;
  nodes: FreeFlowNode[];
  activeNodeId: string | null;
  chainCount: number;
  longestChain: number;
  rewardEarnedSeconds: number;
  quickReserveWasFull: boolean;
  restCheckpointDismissed: boolean;
  startedAtMs: number | null;
  endedAtMs: number | null;
  createdAtMs: number;
  updatedAtMs: number;
  revision: number;
  origin: "free-flow" | "quick-action" | "legacy-single";
};

export type FreeFlowSettings = {
  rewardMode: FreeFlowRewardMode;
  quickThresholdMinutes: number;
  mediumThresholdMinutes: number;
  rememberedFundingMode: QuickActionFundingMode | null;
};

export const DEFAULT_FREE_FLOW_SETTINGS: FreeFlowSettings = {
  rewardMode: "hybrid",
  quickThresholdMinutes: 2,
  mediumThresholdMinutes: 10,
  rememberedFundingMode: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const finiteInteger = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
};

const optionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const ACTION_CLASSES = new Set<ActionClass>(["quick", "medium", "hard"]);
const FUNDING_MODES = new Set<QuickActionFundingMode>([
  "current",
  "vault",
  "next",
  "proportional",
]);

export function normalizeFreeFlowSettings(value: unknown): FreeFlowSettings {
  const record = isRecord(value) ? value : {};
  const quick = Math.max(
    1,
    Math.min(120, finiteInteger(record.freeFlowQuickThresholdMinutes, 2)),
  );
  const medium = Math.max(
    quick + 1,
    Math.min(480, finiteInteger(record.freeFlowMediumThresholdMinutes, 10)),
  );
  return {
    rewardMode:
      record.freeFlowRewardMode === "time" ||
      record.freeFlowRewardMode === "completion"
        ? record.freeFlowRewardMode
        : "hybrid",
    quickThresholdMinutes: quick,
    mediumThresholdMinutes: medium,
    rememberedFundingMode: FUNDING_MODES.has(
      record.freeFlowRememberedFundingMode as QuickActionFundingMode,
    )
      ? (record.freeFlowRememberedFundingMode as QuickActionFundingMode)
      : null,
  };
}

export function suggestActionClass(
  activeSeconds: number,
  settings: Pick<
    FreeFlowSettings,
    "quickThresholdMinutes" | "mediumThresholdMinutes"
  > = DEFAULT_FREE_FLOW_SETTINGS,
): ActionClass {
  const seconds = finiteInteger(activeSeconds);
  if (seconds <= settings.quickThresholdMinutes * 60) return "quick";
  if (seconds <= settings.mediumThresholdMinutes * 60) return "medium";
  return "hard";
}

export function completionBonusSeconds(
  actionClass: ActionClass,
  chainCount: number,
) {
  const base =
    actionClass === "quick" ? 15 : actionClass === "medium" ? 30 : 60;
  const completedBefore = Math.max(0, finiteInteger(chainCount));
  const multiplier = 1 + Math.min(0.5, completedBefore * 0.1);
  return Math.round(base * multiplier);
}

export function elapsedFreeFlowNodeSeconds(
  node: FreeFlowNode,
  nowMs = Date.now(),
) {
  if (node.status !== "active" || node.startedAtMs === null) {
    return finiteInteger(node.accumulatedSeconds);
  }
  return (
    finiteInteger(node.accumulatedSeconds) +
    Math.max(0, Math.floor((finiteInteger(nowMs) - node.startedAtMs) / 1000))
  );
}

export function createFreeFlowRun(
  atMs = Date.now(),
  options: Partial<Pick<FreeFlowRun, "name" | "origin">> = {},
): FreeFlowRun {
  const now = finiteInteger(atMs, Date.now());
  return {
    id: crypto.randomUUID(),
    status: "draft",
    name: options.name?.trim() || "Free Flow",
    nodes: [],
    activeNodeId: null,
    chainCount: 0,
    longestChain: 0,
    rewardEarnedSeconds: 0,
    quickReserveWasFull: false,
    restCheckpointDismissed: false,
    startedAtMs: null,
    endedAtMs: null,
    createdAtMs: now,
    updatedAtMs: now,
    revision: 0,
    origin: options.origin || "free-flow",
  };
}

function normalizeFundingTrace(value: unknown): SessionFundingEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) => ({
      activityId: optionalString(entry.activityId) || "",
      seconds: finiteInteger(entry.seconds),
      offsetSeconds: finiteInteger(entry.offsetSeconds),
    }))
    .filter((entry) => entry.activityId && entry.seconds > 0);
}

function normalizeNode(value: unknown, index: number): FreeFlowNode | null {
  if (!isRecord(value)) return null;
  const id = optionalString(value.id);
  const name = optionalString(value.name);
  if (!id || !name) return null;
  const kind = value.kind === "group" ? "group" : "action";
  const status: FreeFlowNodeStatus =
    value.status === "active" ||
    value.status === "completed" ||
    value.status === "stopped"
      ? value.status
      : "pending";
  return {
    id,
    parentId: optionalString(value.parentId),
    name,
    order: finiteInteger(value.order, index),
    kind,
    status: kind === "group" && status === "active" ? "pending" : status,
    accumulatedSeconds: finiteInteger(value.accumulatedSeconds),
    startedAtMs:
      status === "active" && Number.isFinite(Number(value.startedAtMs))
        ? finiteInteger(value.startedAtMs)
        : null,
    activityDefinitionId: optionalString(value.activityDefinitionId),
    suggestedClass: ACTION_CLASSES.has(value.suggestedClass as ActionClass)
      ? (value.suggestedClass as ActionClass)
      : undefined,
    actionClass: ACTION_CLASSES.has(value.actionClass as ActionClass)
      ? (value.actionClass as ActionClass)
      : undefined,
    completedAtMs:
      value.completedAtMs === undefined
        ? undefined
        : finiteInteger(value.completedAtMs),
    rewardSeconds: finiteInteger(value.rewardSeconds),
    fundingMode: FUNDING_MODES.has(value.fundingMode as QuickActionFundingMode)
      ? (value.fundingMode as QuickActionFundingMode)
      : undefined,
    allowProtectedCurrent: Boolean(value.allowProtectedCurrent),
    sessionCurrentActivityIndex:
      value.sessionCurrentActivityIndex === undefined
        ? undefined
        : finiteInteger(value.sessionCurrentActivityIndex),
    actionOrigin:
      value.actionOrigin === "quick-action" ||
      value.actionOrigin === "legacy-single"
        ? value.actionOrigin
        : value.actionOrigin === "free-flow"
          ? "free-flow"
          : undefined,
    fundingTrace: normalizeFundingTrace(value.fundingTrace),
  };
}

/**
 * Removes malformed nodes and repairs orphaned or cyclic relationships by
 * promoting the affected node to the root. No persisted source is mutated.
 */
export function normalizeFreeFlowNodes(value: unknown): FreeFlowNode[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, FreeFlowNode>();
  value.forEach((candidate, index) => {
    const node = normalizeNode(candidate, index);
    if (node && !unique.has(node.id)) unique.set(node.id, node);
  });
  const nodes = [...unique.values()];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  nodes.forEach((node) => {
    if (
      !node.parentId ||
      node.parentId === node.id ||
      !byId.has(node.parentId)
    ) {
      node.parentId = undefined;
      return;
    }
    const seen = new Set([node.id]);
    let parentId: string | undefined = node.parentId;
    while (parentId) {
      if (seen.has(parentId)) {
        node.parentId = undefined;
        break;
      }
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  });
  const parentIds = new Set(nodes.map((node) => node.parentId).filter(Boolean));
  nodes.forEach((node) => {
    if (parentIds.has(node.id)) {
      node.kind = "group";
      node.startedAtMs = null;
      if (node.status === "active") node.status = "pending";
    }
  });
  return nodes.sort(
    (left, right) =>
      left.order - right.order || left.id.localeCompare(right.id),
  );
}

export function normalizeFreeFlowRun(value: unknown): FreeFlowRun | null {
  if (!isRecord(value)) return null;
  const id = optionalString(value.id);
  if (!id) return null;
  const nodes = normalizeFreeFlowNodes(value.nodes);
  const activeNodes = nodes.filter((node) => node.status === "active");
  const requestedActiveId = optionalString(value.activeNodeId);
  const active =
    activeNodes.find((node) => node.id === requestedActiveId) || activeNodes[0];
  nodes.forEach((node) => {
    if (node.status === "active" && node.id !== active?.id) {
      node.status = "pending";
      node.startedAtMs = null;
    }
  });
  const status: FreeFlowRunStatus =
    value.status === "active" ||
    value.status === "completed" ||
    value.status === "abandoned"
      ? value.status
      : "draft";
  return {
    id,
    status,
    name: optionalString(value.name) || "Free Flow",
    nodes,
    activeNodeId: status === "active" ? active?.id || null : null,
    chainCount: finiteInteger(value.chainCount),
    longestChain: finiteInteger(value.longestChain),
    rewardEarnedSeconds: finiteInteger(value.rewardEarnedSeconds),
    quickReserveWasFull: Boolean(value.quickReserveWasFull),
    restCheckpointDismissed: Boolean(value.restCheckpointDismissed),
    startedAtMs:
      value.startedAtMs === null || value.startedAtMs === undefined
        ? null
        : finiteInteger(value.startedAtMs),
    endedAtMs:
      value.endedAtMs === null || value.endedAtMs === undefined
        ? null
        : finiteInteger(value.endedAtMs),
    createdAtMs: finiteInteger(value.createdAtMs),
    updatedAtMs: finiteInteger(value.updatedAtMs),
    revision: finiteInteger(value.revision),
    origin:
      value.origin === "quick-action" || value.origin === "legacy-single"
        ? value.origin
        : "free-flow",
  };
}

export function freeFlowChildren(nodes: FreeFlowNode[], parentId?: string) {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id),
    );
}

export function freeFlowDepthFirst(nodes: FreeFlowNode[]) {
  const ordered: Array<{ node: FreeFlowNode; depth: number }> = [];
  const visit = (parentId: string | undefined, depth: number) => {
    freeFlowChildren(nodes, parentId).forEach((node) => {
      ordered.push({ node, depth });
      visit(node.id, depth + 1);
    });
  };
  visit(undefined, 0);
  return ordered;
}

export function nextFreeFlowAction(nodes: FreeFlowNode[], afterId?: string) {
  const actions = freeFlowDepthFirst(nodes)
    .map(({ node }) => node)
    .filter((node) => node.kind === "action" && node.status === "pending");
  if (!afterId) return actions[0] || null;
  const flattened = freeFlowDepthFirst(nodes).map(({ node }) => node.id);
  const afterIndex = flattened.indexOf(afterId);
  return (
    actions.find((node) => flattened.indexOf(node.id) > afterIndex) ||
    actions[0] ||
    null
  );
}

export function completeFreeFlowAncestors(nodes: FreeFlowNode[]) {
  const next = nodes.map((node) => ({ ...node }));
  let changed = true;
  while (changed) {
    changed = false;
    next
      .filter((node) => node.kind === "group")
      .forEach((group) => {
        const children = next.filter((node) => node.parentId === group.id);
        const complete =
          children.length > 0 &&
          children.every((child) => child.status === "completed");
        if (complete && group.status !== "completed") {
          group.status = "completed";
          changed = true;
        } else if (!complete && group.status === "completed") {
          group.status = "pending";
          changed = true;
        }
      });
  }
  return next;
}

export function addFreeFlowNode(
  run: FreeFlowRun,
  input: { name: string; parentId?: string; kind?: "group" | "action" },
  atMs = Date.now(),
) {
  const name = input.name.trim();
  if (!name) throw new TypeError("Action name is required.");
  const parent = input.parentId
    ? run.nodes.find((node) => node.id === input.parentId)
    : undefined;
  let nodes = run.nodes.map((node) => ({ ...node }));
  let parentId = parent?.id;
  if (parent && parent.kind === "action") {
    if (parent.accumulatedSeconds === 0 && parent.status === "pending") {
      nodes = nodes.map((node) =>
        node.id === parent.id ? { ...node, kind: "group" as const } : node,
      );
    } else {
      const wrapperId = crypto.randomUUID();
      const wrapper: FreeFlowNode = {
        id: wrapperId,
        parentId: parent.parentId,
        name: parent.name,
        order: parent.order,
        kind: "group",
        status: "pending",
        accumulatedSeconds: 0,
        startedAtMs: null,
        rewardSeconds: 0,
        fundingTrace: [],
      };
      nodes = nodes.map((node) =>
        node.id === parent.id ? { ...node, parentId: wrapperId } : node,
      );
      nodes.push(wrapper);
      parentId = wrapperId;
    }
  }
  const siblings = nodes.filter((node) => node.parentId === parentId);
  const node: FreeFlowNode = {
    id: crypto.randomUUID(),
    parentId,
    name,
    order:
      siblings.reduce((max, sibling) => Math.max(max, sibling.order), -1) + 1,
    kind: input.kind || "action",
    status: "pending",
    accumulatedSeconds: 0,
    startedAtMs: null,
    rewardSeconds: 0,
    fundingTrace: [],
  };
  return {
    ...run,
    nodes: [...nodes, node],
    updatedAtMs: finiteInteger(atMs, Date.now()),
  };
}

export function freeFlowDescendantIds(nodes: FreeFlowNode[], nodeId: string) {
  const ids = new Set<string>();
  const visit = (parentId: string) => {
    nodes
      .filter((node) => node.parentId === parentId)
      .forEach((node) => {
        if (ids.has(node.id)) return;
        ids.add(node.id);
        visit(node.id);
      });
  };
  visit(nodeId);
  return ids;
}

export function removeFreeFlowNode(
  run: FreeFlowRun,
  nodeId: string,
  atMs = Date.now(),
) {
  const node = run.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return run;
  const removed = freeFlowDescendantIds(run.nodes, nodeId);
  removed.add(nodeId);
  if (
    [...removed].some(
      (id) =>
        run.nodes.find((candidate) => candidate.id === id)?.status === "active",
    )
  ) {
    throw new TypeError("Stop the active action before deleting its branch.");
  }
  return {
    ...run,
    nodes: completeFreeFlowAncestors(
      run.nodes.filter((candidate) => !removed.has(candidate.id)),
    ),
    updatedAtMs: finiteInteger(atMs, Date.now()),
  };
}

export function moveFreeFlowNode(
  run: FreeFlowRun,
  nodeId: string,
  direction: -1 | 1,
  atMs = Date.now(),
) {
  const node = run.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return run;
  const siblings = freeFlowChildren(run.nodes, node.parentId);
  const index = siblings.findIndex((candidate) => candidate.id === nodeId);
  const target = siblings[index + direction];
  if (!target) return run;
  return {
    ...run,
    nodes: run.nodes.map((candidate) => {
      if (candidate.id === node.id)
        return { ...candidate, order: target.order };
      if (candidate.id === target.id)
        return { ...candidate, order: node.order };
      return candidate;
    }),
    updatedAtMs: finiteInteger(atMs, Date.now()),
  };
}

export function startFreeFlowNode(
  run: FreeFlowRun,
  nodeId: string,
  atMs = Date.now(),
) {
  const node = run.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.kind !== "action" || node.status === "completed") {
    throw new TypeError("Only an unfinished action can be started.");
  }
  const now = finiteInteger(atMs, Date.now());
  const nodes = run.nodes.map((candidate) => {
    if (candidate.id === nodeId) {
      return { ...candidate, status: "active" as const, startedAtMs: now };
    }
    if (candidate.status === "active") {
      return {
        ...candidate,
        status: "pending" as const,
        accumulatedSeconds: elapsedFreeFlowNodeSeconds(candidate, now),
        startedAtMs: null,
      };
    }
    return candidate;
  });
  return {
    ...run,
    status: "active" as const,
    nodes,
    activeNodeId: nodeId,
    startedAtMs: run.startedAtMs || now,
    endedAtMs: null,
    updatedAtMs: now,
  };
}

export function pauseFreeFlowRun(run: FreeFlowRun, atMs = Date.now()) {
  const now = finiteInteger(atMs, Date.now());
  return {
    ...run,
    nodes: run.nodes.map((node) =>
      node.id === run.activeNodeId && node.status === "active"
        ? {
            ...node,
            status: "pending" as const,
            accumulatedSeconds: elapsedFreeFlowNodeSeconds(node, now),
            startedAtMs: null,
          }
        : node,
    ),
    activeNodeId: null,
    updatedAtMs: now,
  };
}

export type CompleteFreeFlowResult = {
  run: FreeFlowRun;
  completedNode: FreeFlowNode;
  bonusSeconds: number;
  suggestedClass: ActionClass;
  restCheckpoint: boolean;
};

export function completeFreeFlowNode(
  run: FreeFlowRun,
  input: {
    nodeId: string;
    actionClass: ActionClass;
    atMs?: number;
    quickReserveBeforeSeconds?: number;
    quickReserveAfterSeconds?: number;
    quickReserveCapSeconds?: number;
    bonusSecondsOverride?: number;
    classificationSettings?: Pick<
      FreeFlowSettings,
      "quickThresholdMinutes" | "mediumThresholdMinutes"
    >;
  },
): CompleteFreeFlowResult {
  const now = finiteInteger(input.atMs, Date.now());
  const existing = run.nodes.find((node) => node.id === input.nodeId);
  if (!existing || existing.kind !== "action") {
    throw new TypeError("Action not found.");
  }
  const accumulatedSeconds = elapsedFreeFlowNodeSeconds(existing, now);
  const suggestedClass = suggestActionClass(
    accumulatedSeconds,
    input.classificationSettings || DEFAULT_FREE_FLOW_SETTINGS,
  );
  const qualifies = accumulatedSeconds > 0;
  const bonusSeconds = qualifies
    ? input.bonusSecondsOverride === undefined
      ? completionBonusSeconds(input.actionClass, run.chainCount)
      : finiteInteger(input.bonusSecondsOverride)
    : 0;
  let nodes = run.nodes.map((node) =>
    node.id === existing.id
      ? {
          ...node,
          status: "completed" as const,
          accumulatedSeconds,
          startedAtMs: null,
          completedAtMs: now,
          suggestedClass,
          actionClass: input.actionClass,
          rewardSeconds: bonusSeconds,
        }
      : node,
  );
  nodes = completeFreeFlowAncestors(nodes);
  const leaves = nodes.filter((node) => node.kind === "action");
  const allComplete =
    leaves.length > 0 && leaves.every((node) => node.status === "completed");
  const chainCount = qualifies ? run.chainCount + 1 : run.chainCount;
  const cap = finiteInteger(input.quickReserveCapSeconds);
  const before = finiteInteger(input.quickReserveBeforeSeconds);
  const after = finiteInteger(input.quickReserveAfterSeconds);
  const checkpointDismissed =
    cap > 0 && before < cap ? false : run.restCheckpointDismissed;
  const restCheckpoint =
    cap > 0 && before < cap && after >= cap && !checkpointDismissed;
  const completedNode = nodes.find((node) => node.id === existing.id)!;
  return {
    run: {
      ...run,
      status: allComplete ? "completed" : "active",
      nodes,
      activeNodeId: null,
      chainCount,
      longestChain: Math.max(run.longestChain, chainCount),
      rewardEarnedSeconds: run.rewardEarnedSeconds + bonusSeconds,
      quickReserveWasFull: cap > 0 && after >= cap,
      restCheckpointDismissed: restCheckpoint ? false : checkpointDismissed,
      endedAtMs: allComplete ? now : null,
      updatedAtMs: now,
    },
    completedNode,
    bonusSeconds,
    suggestedClass,
    restCheckpoint,
  };
}

export function abandonFreeFlowRun(run: FreeFlowRun, atMs = Date.now()) {
  const now = finiteInteger(atMs, Date.now());
  const paused = pauseFreeFlowRun(run, now);
  return {
    ...paused,
    status: "abandoned" as const,
    chainCount: 0,
    endedAtMs: now,
    updatedAtMs: now,
  };
}

export function legacySingleToFreeFlowRun(
  value: unknown,
  atMs = Date.now(),
): FreeFlowRun | null {
  if (!isRecord(value)) return null;
  const chain = Array.isArray(value.chain) ? value.chain.filter(isRecord) : [];
  const activeName = optionalString(value.activityName);
  const active = Boolean(value.isActive && activeName);
  if (!active && chain.length === 0) return null;
  const run = createFreeFlowRun(atMs, {
    name: "Imported Single flow",
    origin: "legacy-single",
  });
  const nodes: FreeFlowNode[] = chain.flatMap((entry, index) => {
    const name = optionalString(entry.name);
    if (!name) return [];
    const duration = finiteInteger(entry.duration);
    const suggestedClass = suggestActionClass(duration);
    const node: FreeFlowNode = {
      id: `legacy:${run.id}:${index}`,
      name,
      order: index,
      kind: "action" as const,
      status: "completed" as const,
      accumulatedSeconds: duration,
      startedAtMs: null,
      suggestedClass,
      actionClass: suggestedClass,
      completedAtMs: finiteInteger(
        entry.completedAt
          ? new Date(String(entry.completedAt)).getTime()
          : atMs,
        atMs,
      ),
      rewardSeconds: finiteInteger(entry.reward),
      fundingTrace: [],
    };
    return [node];
  });
  if (active && activeName) {
    nodes.push({
      id: `legacy:${run.id}:active`,
      name: activeName,
      order: nodes.length,
      kind: "action",
      status: value.isPaused ? "pending" : "active",
      accumulatedSeconds: finiteInteger(value.elapsedSeconds),
      startedAtMs: value.isPaused ? null : finiteInteger(atMs),
      rewardSeconds: 0,
      fundingTrace: [],
    });
  }
  return {
    ...run,
    status: active ? "active" : "completed",
    nodes,
    activeNodeId: active && !value.isPaused ? nodes.at(-1)?.id || null : null,
    chainCount: finiteInteger(value.currentChainStreak),
    longestChain: finiteInteger(value.currentChainStreak),
    rewardEarnedSeconds: nodes.reduce(
      (sum, node) => sum + node.rewardSeconds,
      0,
    ),
    startedAtMs: finiteInteger(atMs),
    endedAtMs: active ? null : finiteInteger(atMs),
  };
}
