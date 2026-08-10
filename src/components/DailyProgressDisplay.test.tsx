import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDailyVisualModel } from "../domain/dailyVisual";
import { DailyProgressDisplay } from "./DailyProgressDisplay";

describe("DailyProgressDisplay", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  const model = buildDailyVisualModel({
    activities: [
      {
        id: "work",
        name: "Work",
        color: "#ffffff",
        plannedSeconds: 3600,
        actualSeconds: 900,
        status: "active",
      },
      {
        id: "walk",
        name: "Walk",
        color: "#22c55e",
        plannedSeconds: 1800,
        actualSeconds: 0,
      },
    ],
    scope: "full",
    capacitySeconds: 7200,
  });

  it("renders readable linear segments and text equivalents", async () => {
    await act(async () => {
      root.render(
        <DailyProgressDisplay
          model={model}
          view="linear"
          scope="full"
          animate
          onViewChange={() => undefined}
          onScopeChange={() => undefined}
        />,
      );
    });
    expect(
      host.querySelector('[role="img"]')?.getAttribute("aria-label"),
    ).toContain("17%");
    expect(host.textContent).toContain("Work");
    expect(host.textContent).toContain("Free time");
    expect(host.innerHTML).not.toContain("background: rgb(255, 255, 255)");
  });

  it("renders an accessible circular view and emits semantic control changes", async () => {
    const onViewChange = vi.fn();
    const onScopeChange = vi.fn();
    await act(async () => {
      root.render(
        <DailyProgressDisplay
          model={model}
          view="circular"
          scope="full"
          animate={false}
          onViewChange={onViewChange}
          onScopeChange={onScopeChange}
        />,
      );
    });
    expect(host.querySelector("svg")?.getAttribute("aria-label")).toContain(
      "remaining",
    );
    const linear = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "linear",
    );
    const tasks = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Tasks only",
    );
    await act(async () => linear?.click());
    await act(async () => tasks?.click());
    expect(onViewChange).toHaveBeenCalledWith("linear");
    expect(onScopeChange).toHaveBeenCalledWith("tasks");
  });

  it("renders an explicit empty state", async () => {
    const empty = buildDailyVisualModel({ activities: [], scope: "tasks" });
    await act(async () => {
      root.render(
        <DailyProgressDisplay
          model={empty}
          view="linear"
          scope="tasks"
          animate={false}
          onViewChange={() => undefined}
          onScopeChange={() => undefined}
        />,
      );
    });
    expect(host.textContent).toContain("No planned activities");
  });
});
