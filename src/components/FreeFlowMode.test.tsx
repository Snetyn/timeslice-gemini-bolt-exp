import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FreeFlowMode } from "./FreeFlowMode";

vi.mock("../data/freeFlowRepository", () => ({
  getActiveFreeFlowRun: vi.fn(async () => null),
  importLegacySingleState: vi.fn(async () => null),
  listFreeFlowRuns: vi.fn(async () => []),
  saveFreeFlowRun: vi.fn(async (run) => ({
    value: run,
    revision: 1,
    replayed: false,
  })),
}));

vi.mock("../data/activitySessionRepository", () => ({
  switchActivitySession: vi.fn(async () => undefined),
  endActivitySession: vi.fn(async () => undefined),
  listActivitySessions: vi.fn(async () => []),
  correctActivitySessionClassification: vi.fn(async () => undefined),
}));

vi.mock("../data/activityCatalogRepository", () => ({
  createActivityDefinition: vi.fn(async () => ({
    value: { id: "definition" },
  })),
}));

describe("FreeFlowMode", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00Z"));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const click = async (label: string) => {
    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    expect(button).toBeTruthy();
    await act(async () => (button as HTMLButtonElement).click());
  };

  const setInput = async (placeholder: string, value: string) => {
    const input = [...container.querySelectorAll("input")].find(
      (candidate) => candidate.placeholder === placeholder,
    )!;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("builds a run, times one leaf, and asks for explicit classification", async () => {
    const onApplyReward = vi.fn(() => ({
      quickBeforeSeconds: 0,
      quickAfterSeconds: 15,
      creditedSeconds: 15,
      timeCreditedSeconds: 0,
      bonusCreditedSeconds: 15,
    }));
    await act(async () => {
      root.render(
        <FreeFlowMode
          settings={{
            freeFlowRewardMode: "hybrid",
            freeFlowQuickThresholdMinutes: 2,
            freeFlowMediumThresholdMinutes: 10,
          }}
          quickReserveSeconds={0}
          quickReserveCapSeconds={600}
          bankSeconds={0}
          onApplyReward={onApplyReward}
          onTakeRest={vi.fn()}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    await click("Start blank run");
    await setInput("Add an action…", "Clear desk");
    await click("Add");
    await click("Start");
    await act(async () => {
      vi.advanceTimersByTime(121_000);
    });
    await click("Complete");
    expect(container.textContent).toContain("suggested Medium");
    const medium = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Medium"),
    )!;
    expect(medium.getAttribute("aria-pressed")).toBe("true");
    await click("Confirm completion");
    expect(onApplyReward).toHaveBeenCalledWith(121, 30, "hybrid");
    expect(container.textContent).toContain("Save “Clear desk”");
    expect(container.textContent).toContain("Start blank run");
  });
});
