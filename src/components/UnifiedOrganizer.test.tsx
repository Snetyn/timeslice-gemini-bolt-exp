import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFolder } from "../data/activityCatalogRepository";
import {
  createOrganizerTag,
  migrateOrganizer,
} from "../data/organizerRepository";
import { createInboxTask } from "../data/taskPlanningRepository";
import { timeSliceDb } from "../data/timesliceDb";
import { UnifiedOrganizer } from "./UnifiedOrganizer";

const waitFor = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (condition()) return;
    await act(
      () =>
        new Promise<void>((resolve) => window.setTimeout(() => resolve(), 10)),
    );
  }
  throw new Error("Timed out waiting for organizer UI.");
};

const click = async (element: Element) => {
  await act(async () =>
    element.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
};

describe("UnifiedOrganizer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    timeSliceDb.close();
    await timeSliceDb.delete();
    await timeSliceDb.open();
    await migrateOrganizer();
    const folder = (await createFolder({ name: "Home", kind: "folder" })).value;
    const list = (
      await createFolder({
        name: "Chores",
        kind: "list",
        parentId: folder.id,
      })
    ).value;
    const tag = await createOrganizerTag({ name: "House", color: "#0ea5e9" });
    await createInboxTask({
      title: "Clean kitchen",
      kind: "one-off",
      folderId: list.id,
      tagIds: [tag.id],
      baselineDurationSeconds: 1800,
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    timeSliceDb.close();
  });

  it("renders one dashboard with smart views and inline management", async () => {
    await act(async () =>
      root.render(<UnifiedOrganizer open onClose={vi.fn()} />),
    );
    await waitFor(
      () => container.textContent?.includes("Clean kitchen") || false,
    );

    expect(container.textContent).toContain("Tasks & Activities");
    expect(container.textContent).toContain("Folders & Lists");
    expect(container.textContent).toContain("Reusable Activities");
    expect(container.textContent).toContain("Life Areas");
    expect(container.textContent).toContain("Compatibility");
    expect(container.textContent).not.toContain("Activity Management");

    const tagButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("#House"),
    )!;
    await click(tagButton);
    expect(tagButton.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Any");
    expect(container.textContent).toContain("All");
  });

  it("opens a bottom-sheet editor and browser Back closes it first", async () => {
    const onClose = vi.fn();
    await act(async () =>
      root.render(<UnifiedOrganizer open onClose={onClose} />),
    );
    await waitFor(
      () => container.textContent?.includes("Clean kitchen") || false,
    );
    const addTask = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "+ Task",
    )!;
    await click(addTask);
    expect(container.textContent).toContain("Add task");
    expect(
      container.querySelector('[aria-label="Close editor"]'),
    ).not.toBeNull();

    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(container.textContent).not.toContain("Add task");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
