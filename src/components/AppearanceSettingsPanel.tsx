import {
  DEFAULT_APPEARANCE,
  type AppearanceSettings,
  type TimerDisplayVariant,
  type UiAccent,
  type UiDensity,
  type UiTheme,
} from "../lib/appearance";
import { TimerDisplay } from "./TimerDisplay";

type AppearanceSettingsPanelProps = {
  value: AppearanceSettings;
  onChange: (patch: Partial<AppearanceSettings>) => void;
};

const themes: Array<{ value: UiTheme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const densities: Array<{ value: UiDensity; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];
const displays: Array<{ value: TimerDisplayVariant; label: string }> = [
  { value: "ring", label: "Ring" },
  { value: "bar", label: "Bar" },
  { value: "minimal", label: "Minimal" },
];
const accents: UiAccent[] = ["blue", "indigo", "violet", "teal"];

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="ts-setting-field">
      <legend>{label}</legend>
      <div className="ts-segmented-control">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "is-selected" : ""}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AppearanceSettingsPanel({
  value,
  onChange,
}: AppearanceSettingsPanelProps) {
  return (
    <section className="ts-settings-section" aria-labelledby="appearance-title">
      <div className="ts-section-heading">
        <div>
          <span className="ts-eyebrow">Personalize</span>
          <h2 id="appearance-title">Appearance</h2>
          <p>
            Choose a calmer or denser workspace without changing timer behavior.
          </p>
        </div>
        <button
          type="button"
          className="ts-text-button"
          onClick={() => onChange(DEFAULT_APPEARANCE)}
        >
          Reset appearance
        </button>
      </div>

      <div className="ts-appearance-grid">
        <div className="ts-appearance-controls">
          <SegmentedControl
            label="Theme"
            value={value.theme}
            options={themes}
            onChange={(theme) => onChange({ theme })}
          />
          <fieldset className="ts-setting-field">
            <legend>Accent color</legend>
            <div className="ts-accent-options">
              {accents.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  className={`ts-accent-${accent} ${value.accent === accent ? "is-selected" : ""}`}
                  onClick={() => onChange({ accent })}
                  aria-label={`${accent} accent`}
                  aria-pressed={value.accent === accent}
                >
                  <span />
                </button>
              ))}
            </div>
          </fieldset>
          <SegmentedControl
            label="Density"
            value={value.density}
            options={densities}
            onChange={(density) => onChange({ density })}
          />
          <SegmentedControl
            label="Timer display"
            value={value.timerDisplay}
            options={displays}
            onChange={(timerDisplay) => onChange({ timerDisplay })}
          />
          <label className="ts-setting-toggle">
            <span>
              <strong>Reduce visual effects</strong>
              <small>Minimize motion and animated emphasis.</small>
            </span>
            <input
              type="checkbox"
              checked={value.motion === "reduced"}
              onChange={(event) =>
                onChange({
                  motion: event.target.checked ? "reduced" : "system",
                })
              }
            />
          </label>
        </div>

        <div className="ts-appearance-preview" aria-label="Timer preview">
          <span className="ts-eyebrow">Live preview</span>
          <TimerDisplay
            variant={value.timerDisplay}
            model={{
              title: "Focused work",
              timeText: "24:18",
              subtitle: "Ends at 14:35",
              status: "running",
              progress: 62,
              segments: [
                { id: "focus", label: "Focus", color: "#38bdf8", value: 62 },
                { id: "break", label: "Break", color: "#8b5cf6", value: 38 },
              ],
            }}
          />
        </div>
      </div>
    </section>
  );
}
