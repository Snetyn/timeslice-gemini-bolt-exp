import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

type UpdateListener = (available: boolean) => void;

let started = false;
let updateAvailable = false;
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;
const listeners = new Set<UpdateListener>();

const publish = (available: boolean) => {
  updateAvailable = available;
  listeners.forEach((listener) => listener(available));
};

const startRegistration = () => {
  if (started) return;
  started = true;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh: () => publish(true),
    onRegisterError: (error) =>
      console.error("TimeSlice update service could not start", error),
  });
};

export function PwaUpdatePrompt() {
  const [visible, setVisible] = useState(updateAvailable);

  useEffect(() => {
    listeners.add(setVisible);
    startRegistration();
    return () => {
      listeners.delete(setVisible);
    };
  }, []);

  if (!visible) return null;
  return (
    <section
      role="status"
      aria-label="TimeSlice update available"
      className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[10000] mx-auto flex max-w-md items-center gap-2 rounded-lg border border-blue-200 bg-white p-3 shadow-xl"
    >
      <p className="min-w-0 flex-1 text-sm text-slate-700">
        A new TimeSlice version is ready.
      </p>
      <button
        type="button"
        className="min-h-11 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        onClick={() => void applyUpdate?.(true)}
      >
        Update now
      </button>
      <button
        type="button"
        className="min-h-11 rounded-md px-3 text-sm text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onClick={() => setVisible(false)}
      >
        Later
      </button>
    </section>
  );
}
