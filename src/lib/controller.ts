export type ControllerState = {
  instanceId: string;
  isController: boolean;
  supported: boolean;
  ownerHint?: string;
};

type LockManagerLike = {
  request: (
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown | null) => Promise<void>,
  ) => Promise<void>;
};

const instanceId = crypto.randomUUID();
let releaseLock: (() => void) | undefined;
let state: ControllerState = {
  instanceId,
  isController: false,
  supported: typeof navigator !== "undefined" && "locks" in navigator,
};
const listeners = new Set<() => void>();
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("timeslice-controller");

const emit = () => listeners.forEach((listener) => listener());
const publish = () =>
  channel?.postMessage({
    type: "controller",
    instanceId,
    isController: state.isController,
  });

const setState = (next: Partial<ControllerState>) => {
  state = { ...state, ...next };
  emit();
  publish();
};

channel?.addEventListener(
  "message",
  (
    event: MessageEvent<{
      type?: string;
      instanceId?: string;
      isController?: boolean;
    }>,
  ) => {
    if (event.data?.instanceId === instanceId) return;
    if (event.data?.type === "takeover-request" && state.isController) {
      // Explicit request from the user in another window: flush first, then yield.
      releaseLock?.();
      return;
    }
    if (event.data?.type === "controller" && event.data.isController) {
      setState({ ownerHint: event.data.instanceId, isController: false });
    }
  },
);

export const timerController = {
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async claim() {
    const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
    if (!locks) {
      // IndexedDB revision checks remain the safety fallback.
      setState({ supported: false, isController: true });
      return state;
    }
    let resolved = false;
    const ready = new Promise<void>((resolve) => {
      void locks.request(
        "timeslice-timer-controller",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            if (!resolved) {
              resolved = true;
              setState({ isController: false });
              resolve();
            }
            return;
          }
          setState({ isController: true, ownerHint: undefined });
          if (!resolved) {
            resolved = true;
            resolve();
          }
          await new Promise<void>((resolveRelease) => {
            releaseLock = resolveRelease;
          });
          releaseLock = undefined;
          setState({ isController: false });
        },
      );
    });
    await ready;
    return state;
  },
  async takeOver() {
    channel?.postMessage({ type: "takeover-request", instanceId });
    releaseLock?.();
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return this.claim();
  },
  release() {
    releaseLock?.();
  },
};
