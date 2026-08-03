import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityTagPicker } from "./ActivityTagPicker";

describe("ActivityTagPicker", () => {
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

  const renderPicker = async (name = "Focus") => {
    await act(async () => {
      root.render(
        <ActivityTagPicker
          open
          activityName={name}
          assignedTags={[]}
          tags={[
            {
              key: "custom:work",
              name: "work",
              color: "#123456",
              storageValue: "work",
              source: "custom",
            },
          ]}
          onToggle={vi.fn()}
          onCreate={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
  };

  it("keeps the search draft focused across parent rerenders", async () => {
    await renderPicker();
    await act(
      async () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Search or create tag"]',
    )!;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(input, "new tag");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await renderPicker("Focus updated");
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("new tag");
  });
});
