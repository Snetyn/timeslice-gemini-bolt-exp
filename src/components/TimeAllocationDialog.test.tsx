import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AllocationPreview } from "../domain/timeAllocation";
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

  const renderDialog = async (
    remaining: number,
    onClose = vi.fn(),
    onConfirm: (preview: AllocationPreview) => boolean = vi.fn(() => true),
  ) => {
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
          onConfirm={onConfirm}
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

  it("keeps Use all synchronized with the live donor time", async () => {
    await renderDialog(120);
    const useAll = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Use all"),
    )!;
    await act(async () => useAll.click());

    expect(useAll.getAttribute("aria-pressed")).toBe("true");
    expect(useAll.textContent).toContain("2:00");
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Minutes"]')
        ?.value,
    ).toBe("2");

    await renderDialog(119);

    expect(useAll.textContent).toContain("1:59");
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Seconds"]')
        ?.value,
    ).toBe("59");
    expect(container.textContent).not.toContain("Unfunded");
  });

  it("returns to a stable custom draft when the user edits an all-time value", async () => {
    await renderDialog(120);
    const useAll = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Use all"),
    )!;
    await act(async () => useAll.click());
    const minutes = container.querySelector<HTMLInputElement>(
      'input[aria-label="Minutes"]',
    )!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      valueSetter?.call(minutes, "1");
      minutes.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await renderDialog(110);

    expect(useAll.getAttribute("aria-pressed")).toBe("false");
    expect(minutes.value).toBe("1");
  });

  it("confirms the latest live maximum rather than the value at button press", async () => {
    const onConfirm = vi.fn((_preview: AllocationPreview) => true);
    await renderDialog(120, vi.fn(), onConfirm);
    const useAll = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Use all"),
    )!;
    await act(async () => useAll.click());
    await renderDialog(117, vi.fn(), onConfirm);
    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({
      requestedSeconds: 117,
      appliedSeconds: 117,
      unfundedSeconds: 0,
    });
  });
});
