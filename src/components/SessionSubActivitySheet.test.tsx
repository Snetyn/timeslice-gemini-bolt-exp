import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionSubActivitySheet } from "./SessionSubActivitySheet";

describe("SessionSubActivitySheet", () => {
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

  const renderSheet = async (maximumSeconds: number, onPreview = vi.fn()) => {
    await act(async () => {
      root.render(
        <SessionSubActivitySheet
          open
          parentName="Cleaning"
          preview={{
            maximumSeconds,
            requestedSeconds: 0,
            fundedSeconds: 0,
            donatedSecondsById: {},
            valid: false,
          }}
          donorNames={{}}
          existingNames={[]}
          onPreview={onPreview}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
  };

  it("keeps a numeric draft and keyboard focus across timer parent rerenders", async () => {
    const onPreview = vi.fn();
    await renderSheet(300, onPreview);
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Sub-activity minutes"]',
    )!;
    await act(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(input, "2");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
    await renderSheet(299, onPreview);
    expect(input.value).toBe("2");
    expect(document.activeElement).toBe(input);
  });

  it("disables confirmation for duplicate names", async () => {
    await act(async () => {
      root.render(
        <SessionSubActivitySheet
          open
          parentName="Cleaning"
          preview={{
            maximumSeconds: 300,
            requestedSeconds: 60,
            fundedSeconds: 60,
            donatedSecondsById: { work: 60 },
            valid: true,
          }}
          donorNames={{ work: "Work" }}
          existingNames={["Kitchen"]}
          onPreview={vi.fn()}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    const name = container.querySelector<HTMLInputElement>(
      'input[placeholder="Kitchen"]',
    )!;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(name, "kitchen");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("already exists");
    const confirm = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) =>
      button.textContent?.trim().startsWith("Add sub-activity"),
    );
    expect(confirm?.disabled).toBe(true);
  });
});
