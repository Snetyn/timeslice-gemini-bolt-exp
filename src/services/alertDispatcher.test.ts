import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ALERT_PREFERENCES,
  type AlertEvent,
  type AlertPreferences,
} from "../domain/alerts";
import {
  AlertDispatcher,
  spokenAlertText,
  type AlertPlatform,
} from "./alertDispatcher";

const event: AlertEvent = {
  id: "focus:remaining:300",
  type: "remaining-checkpoint",
  timerKey: "session:focus",
  mode: "session",
  occurredAtMs: 1_000,
  activityName: "Focus",
  valueSeconds: 300,
  priority: 2,
};

const preferences: AlertPreferences = {
  ...DEFAULT_ALERT_PREFERENCES,
  enabled: true,
  channels: { visual: true, sound: true, vibration: true, speech: true },
  events: {
    ...DEFAULT_ALERT_PREFERENCES.events,
    "remaining-checkpoint": true,
  },
  speech: {
    ...DEFAULT_ALERT_PREFERENCES.speech,
    enabled: true,
  },
};

const platform = (): AlertPlatform => ({
  support: { sound: true, vibration: true, speech: true },
  playTone: vi.fn(async () => undefined),
  vibrate: vi.fn(() => true),
  speak: vi.fn(),
  cancelSpeech: vi.fn(),
  voices: vi.fn(() => []),
});

describe("AlertDispatcher", () => {
  it("delivers visual, haptic, tone, then concise speech", async () => {
    const adapter = platform();
    const visual = vi.fn();
    await new AlertDispatcher(adapter, visual).deliver(event, preferences);
    expect(visual).toHaveBeenCalledWith(event, "Focus, 5 minutes remaining");
    expect(adapter.vibrate).toHaveBeenCalled();
    expect(
      (adapter.playTone as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      (adapter.speak as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    );
    expect(adapter.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Focus, 5 minutes remaining" }),
    );
  });

  it("does nothing while the master switch is off", async () => {
    const adapter = platform();
    await new AlertDispatcher(adapter, vi.fn()).deliver(event, {
      ...preferences,
      enabled: false,
    });
    expect(adapter.playTone).not.toHaveBeenCalled();
    expect(adapter.speak).not.toHaveBeenCalled();
  });

  it("formats names optionally", () => {
    expect(spokenAlertText(event, preferences.speech)).toBe(
      "Focus, 5 minutes remaining",
    );
    expect(
      spokenAlertText(event, {
        ...preferences.speech,
        includeActivityName: false,
      }),
    ).toBe("5 minutes remaining");
  });
});
