import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ALERT_PREFERENCES } from "../domain/alerts";
import { AlertSettingsSection } from "./AlertSettingsSection";

describe("AlertSettingsSection", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn();
  const onTestSound = vi.fn();
  const onTestVibration = vi.fn();
  const onTestSpeech = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onChange.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const renderSection = async (value: unknown = DEFAULT_ALERT_PREFERENCES) => {
    await act(async () => {
      root.render(
        <AlertSettingsSection
          value={value}
          onChange={onChange}
          support={{ sound: true, vibration: true, speech: true }}
          voices={[]}
          onTestSound={onTestSound}
          onTestVibration={onTestVibration}
          onTestSpeech={onTestSpeech}
        />,
      );
    });
  };

  it("keeps every channel opt-in and exposes explicit test controls", async () => {
    await renderSection();
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Enable alerts"]')
        ?.checked,
    ).toBe(false);
    const buttons = Array.from(container.querySelectorAll("button"));
    await act(async () =>
      buttons.find((button) => button.textContent === "Test sound")?.click(),
    );
    expect(onTestSound).toHaveBeenCalledOnce();
  });

  it("normalizes, sorts, and deduplicates custom checkpoints", async () => {
    await renderSection({
      ...DEFAULT_ALERT_PREFERENCES,
      speech: {
        ...DEFAULT_ALERT_PREFERENCES.speech,
        remainingCheckpointsSeconds: [60],
      },
    });
    const input = container.querySelector<HTMLInputElement>(
      '[aria-label="New remaining-time checkpoint"]',
    )!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      valueSetter?.call(input, "2:30");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add")
        ?.click(),
    );
    expect(
      onChange.mock.calls.at(-1)?.[0].speech.remainingCheckpointsSeconds,
    ).toEqual([150, 60]);
  });

  it("allows a stable empty interval draft while editing", async () => {
    await renderSection({
      ...DEFAULT_ALERT_PREFERENCES,
      speech: {
        ...DEFAULT_ALERT_PREFERENCES.speech,
        elapsedIntervalSeconds: 300,
      },
    });
    const input = Array.from(container.querySelectorAll("input")).find(
      (candidate) =>
        candidate.previousElementSibling?.textContent === "Speak elapsed every",
    )!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      input.focus();
      valueSetter?.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
  });
});
