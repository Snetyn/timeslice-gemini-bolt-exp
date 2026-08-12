import { useEffect, useState } from "react";
import {
  formatAlertClock,
  normalizeAlertPreferences,
  parseAlertClock,
  resolveSpeechProfile,
  type AlertEventType,
  type AlertMode,
  type AlertPreferences,
  type SpeechProfile,
} from "../domain/alerts";
import type { AlertSupport } from "../services/alertDispatcher";

type AlertSettingsSectionProps = {
  value: unknown;
  onChange: (value: AlertPreferences) => void;
  support: AlertSupport;
  voices: SpeechSynthesisVoice[];
  onTestSound: () => void | Promise<void>;
  onTestVibration: () => void;
  onTestSpeech: (mode?: AlertMode) => void;
};

const eventLabels: Array<[AlertEventType, string]> = [
  ["activity-complete", "Activity complete"],
  ["session-complete", "Session or run complete"],
  ["break-complete", "Break complete"],
  ["overtime-start", "Overtime starts"],
  ["quick-reserve-full", "Quick Reserve fills"],
  ["remaining-checkpoint", "Remaining-time checkpoint"],
  ["elapsed-interval", "Elapsed-time interval"],
  ["overtime-interval", "Overtime interval"],
  ["scheduled-task-due", "Scheduled task due"],
];

const modeLabels: Array<[AlertMode, string]> = [
  ["session", "Session"],
  ["daily", "Daily"],
  ["free-flow", "Free Flow"],
  ["flow-break", "Flow breaks"],
];

function ClockField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(formatAlertClock(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(formatAlertClock(value)), [value]);
  const commit = () => {
    if (!draft.trim()) {
      setInvalid(false);
      onChange(null);
      return;
    }
    const parsed = parseAlertClock(draft);
    setInvalid(parsed === null);
    if (parsed !== null) {
      onChange(parsed);
      setDraft(formatAlertClock(parsed));
    }
  };
  return (
    <label className="block min-w-0 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        className={`mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-base tabular-nums ${invalid ? "border-red-500" : "border-slate-300"}`}
        value={draft}
        inputMode="numeric"
        placeholder="MM:SS or off"
        aria-invalid={invalid}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {invalid && (
        <span className="mt-1 block text-xs text-red-700">
          Use MM:SS, for example 2:30.
        </span>
      )}
    </label>
  );
}

function SpeechProfileEditor({
  profile,
  onChange,
  voices,
  compact = false,
}: {
  profile: SpeechProfile;
  onChange: (profile: SpeechProfile) => void;
  voices: SpeechSynthesisVoice[];
  compact?: boolean;
}) {
  const [checkpointDraft, setCheckpointDraft] = useState("");
  const [checkpointError, setCheckpointError] = useState("");
  const patch = (next: Partial<SpeechProfile>) =>
    onChange({ ...profile, ...next });
  const addCheckpoint = () => {
    const seconds = parseAlertClock(checkpointDraft);
    if (seconds === null) {
      setCheckpointError("Enter a positive MM:SS value.");
      return;
    }
    patch({
      remainingCheckpointsSeconds: [
        ...new Set([...profile.remainingCheckpointsSeconds, seconds]),
      ].sort((left, right) => right - left),
    });
    setCheckpointDraft("");
    setCheckpointError("");
  };
  return (
    <div className="space-y-3">
      {!compact && (
        <>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Device voice</span>
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
              value={profile.voiceURI || ""}
              onChange={(event) => {
                const voice = voices.find(
                  (candidate) => candidate.voiceURI === event.target.value,
                );
                patch({
                  voiceURI: event.target.value || null,
                  language: voice?.lang || profile.language,
                });
              }}
            >
              <option value="">System default</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} · {voice.lang}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={profile.includeActivityName}
              onChange={(event) =>
                patch({ includeActivityName: event.target.checked })
              }
            />
            Include the activity name
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["rate", "Speed", 0.5, 2, 0.1],
                ["pitch", "Pitch", 0.5, 2, 0.1],
                ["volume", "Volume", 0, 1, 0.1],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key} className="min-w-0 text-xs text-slate-600">
                {label}
                <input
                  type="range"
                  className="mt-2 w-full"
                  min={min}
                  max={max}
                  step={step}
                  value={profile[key]}
                  onChange={(event) =>
                    patch({ [key]: Number(event.target.value) })
                  }
                />
                <span className="block text-center tabular-nums">
                  {profile[key].toFixed(1)}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
      <div>
        <div className="text-sm font-medium text-slate-700">
          Remaining-time checkpoints
        </div>
        <div className="mt-1 flex gap-2">
          <input
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-base tabular-nums"
            value={checkpointDraft}
            inputMode="numeric"
            placeholder="MM:SS"
            aria-label="New remaining-time checkpoint"
            onChange={(event) => {
              setCheckpointDraft(event.target.value);
              setCheckpointError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") addCheckpoint();
            }}
          />
          <button
            type="button"
            className="min-h-11 rounded-lg bg-indigo-700 px-4 font-semibold text-white"
            onClick={addCheckpoint}
          >
            Add
          </button>
        </div>
        {checkpointError && (
          <div className="mt-1 text-xs text-red-700">{checkpointError}</div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.remainingCheckpointsSeconds.length === 0 ? (
            <span className="text-xs text-slate-500">
              No remaining-time announcements configured.
            </span>
          ) : (
            profile.remainingCheckpointsSeconds.map((seconds) => (
              <button
                key={seconds}
                type="button"
                className="min-h-9 rounded-full border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-800"
                aria-label={`Remove ${formatAlertClock(seconds)} checkpoint`}
                onClick={() =>
                  patch({
                    remainingCheckpointsSeconds:
                      profile.remainingCheckpointsSeconds.filter(
                        (value) => value !== seconds,
                      ),
                  })
                }
              >
                {formatAlertClock(seconds)} ×
              </button>
            ))
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ClockField
          label="Speak elapsed every"
          value={profile.elapsedIntervalSeconds}
          onChange={(elapsedIntervalSeconds) =>
            patch({ elapsedIntervalSeconds })
          }
        />
        <ClockField
          label="Speak overtime every"
          value={profile.overtimeIntervalSeconds}
          onChange={(overtimeIntervalSeconds) =>
            patch({ overtimeIntervalSeconds })
          }
        />
      </div>
    </div>
  );
}

export function AlertSettingsSection({
  value,
  onChange,
  support,
  voices,
  onTestSound,
  onTestVibration,
  onTestSpeech,
}: AlertSettingsSectionProps) {
  const preferences = normalizeAlertPreferences(value);
  const patch = (next: Partial<AlertPreferences>) =>
    onChange({ ...preferences, ...next });
  return (
    <div className="space-y-4" aria-label="Alerts and voice settings">
      <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-indigo-50 px-3">
        <div>
          <div className="font-semibold text-indigo-950">Alerts</div>
          <div className="text-xs text-indigo-700">Everything is opt-in.</div>
        </div>
        <input
          type="checkbox"
          className="h-6 w-6"
          aria-label="Enable alerts"
          checked={preferences.enabled}
          onChange={(event) => patch({ enabled: event.target.checked })}
        />
      </div>

      <section className="space-y-2">
        <h3 className="font-semibold">Channels</h3>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["visual", "Visual banner", true],
              ["sound", "Sound", support.sound],
              ["vibration", "Vibration", support.vibration],
              ["speech", "Spoken timer", support.speech],
            ] as const
          ).map(([channel, label, available]) => (
            <label
              key={channel}
              className="flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3 text-sm"
            >
              <input
                type="checkbox"
                className="h-5 w-5"
                disabled={!available}
                checked={preferences.channels[channel] && available}
                onChange={(event) =>
                  patch({
                    channels: {
                      ...preferences.channels,
                      [channel]: event.target.checked,
                    },
                  })
                }
              />
              <span>
                {label}
                {!available && (
                  <span className="block text-[10px] text-slate-500">
                    Unavailable here
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!support.sound}
            className="min-h-11 rounded-lg border bg-white text-sm font-semibold disabled:opacity-40"
            onClick={() => void onTestSound()}
          >
            Test sound
          </button>
          <button
            type="button"
            disabled={!support.vibration}
            className="min-h-11 rounded-lg border bg-white text-sm font-semibold disabled:opacity-40"
            onClick={onTestVibration}
          >
            Test buzz
          </button>
          <button
            type="button"
            disabled={!support.speech}
            className="min-h-11 rounded-lg border bg-white text-sm font-semibold disabled:opacity-40"
            onClick={() => onTestSpeech("session")}
          >
            Test voice
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Alert events</h3>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {eventLabels.map(([type, label]) => (
            <label
              key={type}
              className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={preferences.events[type]}
                onChange={(event) =>
                  patch({
                    events: {
                      ...preferences.events,
                      [type]: event.target.checked,
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-violet-950">Spoken timer</h3>
            <p className="text-xs text-slate-600">
              Custom checkpoints only; missed background speech is never
              replayed.
            </p>
          </div>
          <input
            type="checkbox"
            className="h-6 w-6"
            aria-label="Enable spoken timer profile"
            checked={preferences.speech.enabled}
            onChange={(event) =>
              patch({
                speech: {
                  ...preferences.speech,
                  enabled: event.target.checked,
                },
              })
            }
          />
        </div>
        <SpeechProfileEditor
          profile={preferences.speech}
          voices={voices}
          onChange={(speech) => patch({ speech })}
        />
        <details className="rounded-lg border bg-white p-2">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            Per-mode voice overrides
          </summary>
          <div className="space-y-2 pt-2">
            {modeLabels.map(([mode, label]) => {
              const override = preferences.speechOverrides[mode];
              const profile = resolveSpeechProfile(preferences, mode);
              return (
                <details key={mode} className="rounded-lg border p-2">
                  <summary className="min-h-11 cursor-pointer py-3 font-medium">
                    {label} {override ? "· custom" : "· global"}
                  </summary>
                  <label className="mb-3 flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={Boolean(override)}
                      onChange={(event) => {
                        const speechOverrides = {
                          ...preferences.speechOverrides,
                        };
                        if (event.target.checked)
                          speechOverrides[mode] = { ...profile };
                        else delete speechOverrides[mode];
                        patch({ speechOverrides });
                      }}
                    />
                    Use a custom schedule for {label}
                  </label>
                  {override && (
                    <SpeechProfileEditor
                      compact
                      profile={profile}
                      voices={voices}
                      onChange={(next) =>
                        patch({
                          speechOverrides: {
                            ...preferences.speechOverrides,
                            [mode]: next,
                          },
                        })
                      }
                    />
                  )}
                </details>
              );
            })}
          </div>
        </details>
      </section>

      <section className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Sound tone
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
            value={preferences.tone}
            onChange={(event) =>
              patch({ tone: event.target.value as AlertPreferences["tone"] })
            }
          >
            <option value="soft">Soft</option>
            <option value="clear">Clear</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </section>
    </div>
  );
}
