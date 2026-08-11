import { beforeEach, describe, expect, it } from "vitest";
import { createFreeFlowRun, addFreeFlowNode } from "../domain/freeFlow";
import { timeSliceDb } from "./timesliceDb";
import {
  getActiveFreeFlowRun,
  importLegacySingleState,
  listFreeFlowRuns,
  saveFreeFlowRun,
} from "./freeFlowRepository";

describe("Free Flow repository", () => {
  beforeEach(async () => {
    await timeSliceDb.delete();
    await timeSliceDb.open();
  });

  it("persists runs in meta without changing database version", async () => {
    let run = createFreeFlowRun(1);
    run = addFreeFlowNode(run, { name: "Action" }, 2);
    run.status = "active";
    const saved = await saveFreeFlowRun(run, "save-run");
    expect(saved.replayed).toBe(false);
    expect((await getActiveFreeFlowRun())?.nodes[0].name).toBe("Action");
    expect(timeSliceDb.verno).toBe(5);

    const replay = await saveFreeFlowRun(run, "save-run");
    expect(replay.replayed).toBe(true);
  });

  it("imports legacy Single once without rewriting its input", async () => {
    const legacy = {
      isActive: false,
      activityName: "",
      chain: [{ name: "Finished", duration: 50, reward: 10 }],
      currentChainStreak: 1,
    };
    const source = JSON.stringify(legacy);
    const imported = await importLegacySingleState(legacy, 1_000);
    const second = await importLegacySingleState(
      {
        ...legacy,
        chain: [...legacy.chain, { name: "Duplicate", duration: 4, reward: 1 }],
      },
      2_000,
    );
    expect(imported?.origin).toBe("legacy-single");
    expect(second).toBeNull();
    expect(await listFreeFlowRuns()).toHaveLength(1);
    expect(JSON.stringify(legacy)).toBe(source);
  });
});
