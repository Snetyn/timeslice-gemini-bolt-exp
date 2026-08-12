import {
  DEFAULT_SPEECH_PROFILE,
  resolveSpeechProfile,
  type AlertEvent,
  type AlertPreferences,
  type AlertTone,
  type SpeechProfile,
} from "../domain/alerts";

export type AlertSupport = {
  sound: boolean;
  vibration: boolean;
  speech: boolean;
};

export type SpokenAlert = {
  text: string;
  profile: SpeechProfile;
};

export type AlertPlatform = {
  support: AlertSupport;
  playTone: (
    tone: AlertTone,
    priority: AlertEvent["priority"],
  ) => Promise<void>;
  vibrate: (pattern: number | number[]) => boolean;
  speak: (alert: SpokenAlert) => void;
  cancelSpeech: () => void;
  voices: () => SpeechSynthesisVoice[];
};

const durationWords = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (remainder || parts.length === 0)
    parts.push(`${remainder} ${remainder === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
};

export function spokenAlertText(event: AlertEvent, profile: SpeechProfile) {
  const name =
    profile.includeActivityName && event.activityName
      ? `${event.activityName}, `
      : "";
  switch (event.type) {
    case "remaining-checkpoint":
      return `${name}${durationWords(event.valueSeconds)} remaining`;
    case "elapsed-interval":
      return `${name}${durationWords(event.valueSeconds)} elapsed`;
    case "overtime-interval":
      return `${name}${durationWords(event.valueSeconds)} overtime`;
    case "overtime-start":
      return `${name}overtime started`;
    case "activity-complete":
      return `${name || "Activity "}complete`;
    case "session-complete":
      return "Session complete";
    case "break-complete":
      return "Break complete";
    case "quick-reserve-full":
      return "Quick Reserve is full";
    case "scheduled-task-due":
      return `${name || "Scheduled task "}is due`;
  }
}

export function visualAlertText(event: AlertEvent) {
  return spokenAlertText(event, {
    ...DEFAULT_SPEECH_PROFILE,
    includeActivityName: true,
  });
}

const vibrationPattern = (priority: AlertEvent["priority"]) => {
  if (priority >= 4) return [160, 80, 160];
  if (priority === 3) return [120, 70, 120, 70, 120];
  return 100;
};

export class AlertDispatcher {
  private activeSpeechTimerKey = "";

  constructor(
    private readonly platform: AlertPlatform,
    private readonly onVisualAlert: (event: AlertEvent, text: string) => void,
  ) {}

  async deliver(event: AlertEvent, preferences: AlertPreferences) {
    if (!preferences.enabled || !preferences.events[event.type]) return;
    const profile = resolveSpeechProfile(preferences, event.mode);
    if (preferences.channels.visual) {
      this.onVisualAlert(event, visualAlertText(event));
    }
    if (preferences.channels.vibration && this.platform.support.vibration) {
      this.platform.vibrate(vibrationPattern(event.priority));
    }
    if (preferences.channels.sound && this.platform.support.sound) {
      await this.platform.playTone(preferences.tone, event.priority);
    }
    if (
      preferences.channels.speech &&
      profile.enabled &&
      this.platform.support.speech
    ) {
      if (
        event.priority >= 3 ||
        (this.activeSpeechTimerKey &&
          this.activeSpeechTimerKey !== event.timerKey)
      ) {
        this.platform.cancelSpeech();
      }
      this.activeSpeechTimerKey = event.timerKey;
      this.platform.speak({ text: spokenAlertText(event, profile), profile });
    }
  }

  cancelSpeech() {
    this.activeSpeechTimerKey = "";
    this.platform.cancelSpeech();
  }
}

let audioContext: AudioContext | null = null;

const toneDefinition = (tone: AlertTone, priority: AlertEvent["priority"]) => {
  const base = tone === "soft" ? 440 : tone === "urgent" ? 740 : 560;
  return {
    frequency: base + (priority - 1) * 70,
    durationMs: priority >= 4 ? 240 : 150,
  };
};

export function createBrowserAlertPlatform(): AlertPlatform {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  const synthesis = window.speechSynthesis;
  return {
    support: {
      sound: Boolean(AudioContextConstructor),
      vibration: typeof navigator.vibrate === "function",
      speech:
        Boolean(synthesis) && typeof SpeechSynthesisUtterance === "function",
    },
    async playTone(tone, priority) {
      if (!AudioContextConstructor) return;
      audioContext ||= new AudioContextConstructor();
      if (audioContext.state === "suspended") await audioContext.resume();
      const definition = toneDefinition(tone, priority);
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = definition.frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.18,
        audioContext.currentTime + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + definition.durationMs / 1000,
      );
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + definition.durationMs / 1000);
      await new Promise((resolve) =>
        window.setTimeout(resolve, definition.durationMs),
      );
    },
    vibrate(pattern) {
      return typeof navigator.vibrate === "function"
        ? navigator.vibrate(pattern)
        : false;
    },
    speak({ text, profile }) {
      if (!synthesis) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = profile.language;
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = profile.volume;
      const voice = synthesis
        .getVoices()
        .find((candidate) => candidate.voiceURI === profile.voiceURI);
      if (voice) utterance.voice = voice;
      synthesis.speak(utterance);
    },
    cancelSpeech() {
      synthesis?.cancel();
    },
    voices() {
      return synthesis?.getVoices() || [];
    },
  };
}
