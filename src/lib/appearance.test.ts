import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPEARANCE,
  applyAppearanceToDocument,
  normalizeAppearanceSettings,
  resolveUiTheme,
} from "./appearance";

describe("appearance settings", () => {
  it("uses stable defaults for an empty or invalid record", () => {
    expect(normalizeAppearanceSettings(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(
      normalizeAppearanceSettings({ appearance: { theme: "neon" } }),
    ).toEqual(DEFAULT_APPEARANCE);
  });

  it("migrates legacy display and mobile density choices", () => {
    expect(
      normalizeAppearanceSettings({
        progressView: "linear",
        mobileZoomLevel: "compact",
      }),
    ).toMatchObject({ timerDisplay: "bar", density: "compact" });
    expect(
      normalizeAppearanceSettings({
        progressView: "circular",
        mobileZoomLevel: "large",
      }),
    ).toMatchObject({ timerDisplay: "ring", density: "spacious" });
  });

  it("prefers valid explicit appearance values over legacy values", () => {
    expect(
      normalizeAppearanceSettings({
        progressView: "linear",
        appearance: {
          theme: "dark",
          accent: "teal",
          density: "comfortable",
          motion: "reduced",
          timerDisplay: "minimal",
        },
      }),
    ).toEqual({
      theme: "dark",
      accent: "teal",
      density: "comfortable",
      motion: "reduced",
      timerDisplay: "minimal",
    });
  });

  it("resolves and applies system theme without losing the preference", () => {
    expect(resolveUiTheme("system", true)).toBe("dark");
    applyAppearanceToDocument(DEFAULT_APPEARANCE, document, true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePreference).toBe("system");
    expect(document.documentElement.dataset.accent).toBe("blue");
  });
});
