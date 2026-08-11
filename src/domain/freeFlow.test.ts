import { describe, expect, it, vi } from "vitest";
import {
  abandonFreeFlowRun,
  addFreeFlowNode,
  completeFreeFlowNode,
  completionBonusSeconds,
  createFreeFlowRun,
  freeFlowDepthFirst,
  legacySingleToFreeFlowRun,
  normalizeFreeFlowNodes,
  normalizeFreeFlowRun,
  pauseFreeFlowRun,
  removeFreeFlowNode,
  moveFreeFlowNode,
  startFreeFlowNode,
  suggestActionClass,
} from "./freeFlow";

describe("Free Flow domain", () => {
  it("suggests configurable classes at stable boundaries", () => {
    expect(suggestActionClass(120)).toBe("quick");
    expect(suggestActionClass(121)).toBe("medium");
    expect(suggestActionClass(600)).toBe("medium");
    expect(suggestActionClass(601)).toBe("hard");
    expect(
      suggestActionClass(301, {
        quickThresholdMinutes: 5,
        mediumThresholdMinutes: 20,
      }),
    ).toBe("medium");
  });

  it("uses the gentle deterministic chain curve", () => {
    expect(completionBonusSeconds("quick", 0)).toBe(15);
    expect(completionBonusSeconds("medium", 1)).toBe(33);
    expect(completionBonusSeconds("hard", 5)).toBe(90);
    expect(completionBonusSeconds("hard", 50)).toBe(90);
  });

  it("repairs orphans and cycles without dropping valid nodes", () => {
    const nodes = normalizeFreeFlowNodes([
      { id: "a", name: "A", parentId: "b", kind: "action" },
      { id: "b", name: "B", parentId: "a", kind: "group" },
      { id: "c", name: "C", parentId: "missing", kind: "action" },
      { id: "bad" },
    ]);
    expect(nodes).toHaveLength(3);
    expect(nodes.find((node) => node.id === "a")?.parentId).toBeUndefined();
    expect(nodes.find((node) => node.id === "c")?.parentId).toBeUndefined();
  });

  it("supports arbitrary-depth groups and completes ancestors", () => {
    let run = createFreeFlowRun(1);
    run = addFreeFlowNode(run, { name: "Home", kind: "group" }, 2);
    const home = run.nodes[0];
    run = addFreeFlowNode(
      run,
      { name: "Kitchen", parentId: home.id, kind: "group" },
      3,
    );
    const kitchen = run.nodes.find((node) => node.name === "Kitchen")!;
    run = addFreeFlowNode(run, { name: "Dishes", parentId: kitchen.id }, 4);
    const dishes = run.nodes.find((node) => node.name === "Dishes")!;
    expect(freeFlowDepthFirst(run.nodes).map(({ depth }) => depth)).toEqual([
      0, 1, 2,
    ]);
    run = startFreeFlowNode(run, dishes.id, 10);
    const completed = completeFreeFlowNode(run, {
      nodeId: dishes.id,
      actionClass: "quick",
      atMs: 20_010,
    });
    expect(completed.run.status).toBe("completed");
    expect(
      completed.run.nodes.filter((node) => node.status === "completed"),
    ).toHaveLength(3);
  });

  it("wraps an already-timed leaf before adding a child", () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn() });
    let id = 0;
    vi.mocked(crypto.randomUUID).mockImplementation(
      () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    );
    let run = createFreeFlowRun(1);
    run = addFreeFlowNode(run, { name: "Timed" }, 2);
    run.nodes[0].accumulatedSeconds = 4;
    run = addFreeFlowNode(run, { name: "Child", parentId: run.nodes[0].id }, 3);
    const timed = run.nodes.find((node) => node.name === "Timed")!;
    const wrapper = run.nodes.find(
      (node) => node.kind === "group" && node.name === "Timed",
    )!;
    expect(timed.parentId).toBe(wrapper.id);
    expect(run.nodes.find((node) => node.name === "Child")?.parentId).toBe(
      wrapper.id,
    );
    vi.unstubAllGlobals();
  });

  it("preserves elapsed time through pause and abandon", () => {
    let run = createFreeFlowRun(1);
    run = addFreeFlowNode(run, { name: "Action" }, 2);
    run = startFreeFlowNode(run, run.nodes[0].id, 1_000);
    run = pauseFreeFlowRun(run, 6_500);
    expect(run.nodes[0].accumulatedSeconds).toBe(5);
    expect(abandonFreeFlowRun(run, 7_000).status).toBe("abandoned");
  });

  it("moves sibling subtrees and removes a branch safely", () => {
    let run = createFreeFlowRun(1);
    run = addFreeFlowNode(run, { name: "First", kind: "group" }, 2);
    run = addFreeFlowNode(run, { name: "Second" }, 3);
    const first = run.nodes.find((node) => node.name === "First")!;
    run = addFreeFlowNode(run, { name: "Child", parentId: first.id }, 4);
    const second = run.nodes.find((node) => node.name === "Second")!;
    run = moveFreeFlowNode(run, second.id, -1, 5);
    expect(freeFlowDepthFirst(run.nodes)[0].node.name).toBe("Second");
    run = removeFreeFlowNode(run, first.id, 6);
    expect(run.nodes.map((node) => node.name)).toEqual(["Second"]);
  });

  it("normalizes duplicate active nodes to a single timer", () => {
    const run = normalizeFreeFlowRun({
      id: "r",
      status: "active",
      activeNodeId: "b",
      nodes: [
        { id: "a", name: "A", status: "active", startedAtMs: 1 },
        { id: "b", name: "B", status: "active", startedAtMs: 2 },
      ],
    });
    expect(run?.nodes.filter((node) => node.status === "active")).toHaveLength(
      1,
    );
    expect(run?.activeNodeId).toBe("b");
  });

  it("offers rest only when the run newly fills Quick Reserve", () => {
    let run = createFreeFlowRun(1);
    run = addFreeFlowNode(run, { name: "Action" }, 2);
    run = startFreeFlowNode(run, run.nodes[0].id, 1_000);
    const newlyFull = completeFreeFlowNode(run, {
      nodeId: run.nodes[0].id,
      actionClass: "quick",
      atMs: 2_000,
      quickReserveBeforeSeconds: 590,
      quickReserveAfterSeconds: 600,
      quickReserveCapSeconds: 600,
    });
    expect(newlyFull.restCheckpoint).toBe(true);

    run.nodes[0].status = "pending";
    run.nodes[0].startedAtMs = 1_000;
    run.nodes[0].status = "active";
    const alreadyFull = completeFreeFlowNode(run, {
      nodeId: run.nodes[0].id,
      actionClass: "quick",
      atMs: 2_000,
      quickReserveBeforeSeconds: 600,
      quickReserveAfterSeconds: 600,
      quickReserveCapSeconds: 600,
    });
    expect(alreadyFull.restCheckpoint).toBe(false);
  });

  it("imports legacy Single without mutating its source shape", () => {
    const legacy = {
      isActive: true,
      isPaused: false,
      activityName: "Current",
      elapsedSeconds: 12,
      currentChainStreak: 1,
      chain: [{ name: "Done", duration: 90, reward: 20 }],
    };
    const before = JSON.stringify(legacy);
    const run = legacySingleToFreeFlowRun(legacy, 10_000);
    expect(run?.origin).toBe("legacy-single");
    expect(run?.nodes).toHaveLength(2);
    expect(JSON.stringify(legacy)).toBe(before);
  });
});
