export type UiTheme = "system" | "light" | "dark";
export type UiAccent = "blue" | "indigo" | "violet" | "teal";
export type UiDensity = "compact" | "comfortable" | "spacious";
export type UiMotion = "system" | "reduced";
export type TimerDisplayVariant = "ring" | "bar" | "minimal";

export type AppearanceSettings = {
  theme: UiTheme;
  accent: UiAccent;
  density: UiDensity;
  motion: UiMotion;
  timerDisplay: TimerDisplayVariant;
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "system",
  accent: "blue",
  density: "comfortable",
  motion: "system",
  timerDisplay: "ring",
};

const isOneOf = <T extends string>(
  value: unknown,
  values: readonly T[],
): value is T => typeof value === "string" && values.includes(value as T);

export function normalizeAppearanceSettings(
  settings: Record<string, unknown> | null | undefined,
): AppearanceSettings {
  const appearance =
    settings?.appearance && typeof settings.appearance === "object"
      ? (settings.appearance as Record<string, unknown>)
      : {};

  const legacyDisplay =
    settings?.progressView === "linear"
      ? "bar"
      : settings?.progressView === "circular"
        ? "ring"
        : DEFAULT_APPEARANCE.timerDisplay;
  const legacyDensity =
    settings?.mobileZoomLevel === "compact"
      ? "compact"
      : settings?.mobileZoomLevel === "large"
        ? "spacious"
        : DEFAULT_APPEARANCE.density;

  return {
    theme: isOneOf(appearance.theme, ["system", "light", "dark"] as const)
      ? appearance.theme
      : DEFAULT_APPEARANCE.theme,
    accent: isOneOf(appearance.accent, [
      "blue",
      "indigo",
      "violet",
      "teal",
    ] as const)
      ? appearance.accent
      : DEFAULT_APPEARANCE.accent,
    density: isOneOf(appearance.density, [
      "compact",
      "comfortable",
      "spacious",
    ] as const)
      ? appearance.density
      : legacyDensity,
    motion: isOneOf(appearance.motion, ["system", "reduced"] as const)
      ? appearance.motion
      : DEFAULT_APPEARANCE.motion,
    timerDisplay: isOneOf(appearance.timerDisplay, [
      "ring",
      "bar",
      "minimal",
    ] as const)
      ? appearance.timerDisplay
      : legacyDisplay,
  };
}

export const resolveUiTheme = (theme: UiTheme, prefersDark: boolean) =>
  theme === "system" ? (prefersDark ? "dark" : "light") : theme;

const themeColors: Record<UiAccent, { light: string; dark: string }> = {
  blue: { light: "#2563eb", dark: "#60a5fa" },
  indigo: { light: "#4f46e5", dark: "#818cf8" },
  violet: { light: "#7c3aed", dark: "#a78bfa" },
  teal: { light: "#0f766e", dark: "#2dd4bf" },
};

export function applyAppearanceToDocument(
  appearance: AppearanceSettings,
  targetDocument: Document = document,
  prefersDark = typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches,
) {
  const resolvedTheme = resolveUiTheme(appearance.theme, Boolean(prefersDark));
  const root = targetDocument.documentElement;
  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = appearance.theme;
  root.dataset.accent = appearance.accent;
  root.dataset.density = appearance.density;
  root.dataset.motion = appearance.motion;
  root.style.colorScheme = resolvedTheme;

  const themeColor = targetDocument.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  themeColor?.setAttribute(
    "content",
    themeColors[appearance.accent][resolvedTheme],
  );

  return resolvedTheme;
}
