import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeAllocationDialog } from "./TimeAllocationDialog";

describe("TimeAllocationDialog", () => {
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

  const renderDialog = async (remaining: number, onClose = vi.fn()) => {
    await act(async () => {
      root.render(
        <TimeAllocationDialog
          open
          title="Transfer time"
          activities={[
            { id: "source", name: "Source", timeRemaining: remaining },
          ]}
          vaultSeconds={0}
          sessionRevision={remaining}
          sourceId="source"
          targetId="vault"
          onClose={onClose}
          onConfirm={vi.fn(() => true)}
        />,
      );
    });
  };

  it("keeps the numeric draft focused across timer-driven parent rerenders", async () => {
    await renderDialog(120);
    const minutes = container.querySelector<HTMLInputElement>(
      'input[aria-label="Minutes"]',
    );
    expect(minutes).not.toBeNull();
    minutes!.focus();
    expect(document.activeElement).toBe(minutes);

    await renderDialog(119, vi.fn());

    expect(document.activeElement).toBe(minutes);
  });

  it("allows an empty draft while editing instead of forcing zero", async () => {
    await renderDialog(120);
    const minutes = container.querySelector<HTMLInputElement>(
      'input[aria-label="Minutes"]',
    )!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      valueSetter?.call(minutes, "");
      minutes.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(minutes.value).toBe("");

    await renderDialog(119, vi.fn());

    expect(minutes.value).toBe("");
  });
});
