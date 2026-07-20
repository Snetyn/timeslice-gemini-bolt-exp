const STORAGE_KEY = "timeslice.state.v2";

type StorageEnvelope = {
  version: 2;
  values: Record<string, string>;
};

const emptyEnvelope = (): StorageEnvelope => ({ version: 2, values: {} });

function readEnvelope(): StorageEnvelope {
  if (typeof window === "undefined") return emptyEnvelope();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyEnvelope();
    const parsed = JSON.parse(raw) as Partial<StorageEnvelope>;
    if (
      parsed.version !== 2 ||
      !parsed.values ||
      typeof parsed.values !== "object"
    ) {
      return emptyEnvelope();
    }
    return { version: 2, values: parsed.values };
  } catch {
    return emptyEnvelope();
  }
}

function writeEnvelope(envelope: StorageEnvelope) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

/**
 * Storage facade for TimeSlice state. It deliberately never reads legacy
 * `timeSlice*` keys, allowing a clean v2 start without deleting old data.
 */
export const appStorage = {
  getItem(key: string): string | null {
    return readEnvelope().values[key] ?? null;
  },

  setItem(key: string, value: string) {
    const envelope = readEnvelope();
    envelope.values[key] = String(value);
    writeEnvelope(envelope);
  },

  removeItem(key: string) {
    const envelope = readEnvelope();
    delete envelope.values[key];
    writeEnvelope(envelope);
  },
};

export { STORAGE_KEY };
