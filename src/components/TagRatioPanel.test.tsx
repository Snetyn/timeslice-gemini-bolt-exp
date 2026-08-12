import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TagChartView,
  TagMatchMode,
  TagRatioMetric,
} from "../domain/tagInsights";
import { TagRatioPanel } from "./TagRatioPanel";

const tags = [
  { id: "work", name: "Work", color: "#2563eb" },
  { id: "health", name: "Health", color: "#10b981" },
  { id: "fun", name: "Fun", color: "#a855f7" },
];

describe("TagRatioPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (initial: string[] = []) => {
    const levelChange = vi.fn();
    function Harness() {
      const [selected, setSelected] = useState(initial);
      const [metric, setMetric] = useState<TagRatioMetric>("plan");
      const [matchMode, setMatchMode] = useState<TagMatchMode>("any");
      const [view, setView] = useState<TagChartView>("donut");
      return (
        <TagRatioPanel
          mode="session"
          activities={[
            {
              id: "one",
              tagIds: ["work", "health"],
              planSeconds: 600,
              remainingSeconds: 300,
              actualSeconds: 300,
            },
          ]}
          tags={tags}
          selectedTagIds={selected}
          onSelectionChange={setSelected}
          metric={metric}
          matchMode={matchMode}
          view={view}
          onMetricChange={setMetric}
          onMatchModeChange={setMatchMode}
          onViewChange={setView}
          rpgLevels={tags.map((tag, index) => ({
            ...tag,
            attributedSeconds: index * 60,
            level: index,
            progress: 0.5,
            secondsToNextLevel: 30,
          }))}
          rpgMinutesPerLevel={60}
          onRpgMinutesPerLevelChange={levelChange}
        />
      );
    }
    await act(async () => root.render(<Harness />));
    return { levelChange };
  };

  const click = async (element: Element) => {
    await act(async () =>
      element.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
  };

  it("prompts before selection and renders the donut plus textual ratios afterward", async () => {
    await render();
    expect(container.textContent).toContain("Select one or more tags");
    await click(
      [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Work"),
      )!,
    );
    expect(
      container.querySelector('[data-testid="tag-ratio-donut"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("100%");
    expect(container.textContent).toContain("10m 00s");
  });

  it("keeps selected chips first, searches, clears, and exposes semantic controls", async () => {
    await render(["health"]);
    const chips = [
      ...container
        .querySelector('[aria-label="Choose tags"]')!
        .querySelectorAll("button"),
    ];
    expect(chips[0].textContent).toContain("Health");
    expect(chips[0].getAttribute("aria-pressed")).toBe("true");
    const search = container.querySelector<HTMLInputElement>(
      'input[aria-label="Search tags"]',
    )!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(search, "fun");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      container.querySelector('[aria-label="Choose tags"]')!.textContent,
    ).toContain("Fun");
    expect(
      container.querySelector('[aria-label="Choose tags"]')!.textContent,
    ).not.toContain("Work");
    await click(
      [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "Clear",
      )!,
    );
    expect(container.textContent).toContain("Select one or more tags");
  });

  it("renders small-selection radar and configurable RPG feedback", async () => {
    const { levelChange } = await render(["work", "health"]);
    await click(
      [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "Radar",
      )!,
    );
    expect(container.querySelector('[data-testid="tag-ratio-radar"]')).not.toBe(
      null,
    );
    expect(container.textContent).toContain("Work · 50.0%");
    await click(
      [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "RPG",
      )!,
    );
    expect(container.querySelector('[data-testid="tag-rpg-radar"]')).not.toBe(
      null,
    );
    expect(container.textContent).toContain("Level 0");
    expect(container.textContent).toContain("Level 1");
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Minutes per RPG level"]',
    )!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "90");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(levelChange).toHaveBeenCalledWith(90);
  });
});
