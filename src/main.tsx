import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { appStorage, hydrateAppStorage } from "./lib/storage";
import { timerController } from "./lib/controller";
import {
  applyAppearanceToDocument,
  normalizeAppearanceSettings,
} from "./lib/appearance";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

async function boot() {
  try {
    await hydrateAppStorage();
    const savedSettings = appStorage.getItem("timeSliceSettings");
    let parsedSettings: Record<string, unknown> | undefined;
    try {
      parsedSettings = savedSettings ? JSON.parse(savedSettings) : undefined;
    } catch {
      parsedSettings = undefined;
    }
    applyAppearanceToDocument(normalizeAppearanceSettings(parsedSettings));
    await timerController.claim();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    console.error("TimeSlice storage failed to start", error);
    root.render(
      <main className="min-h-screen grid place-items-center p-6 text-slate-900">
        <section className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <h1 className="font-semibold">
            TimeSlice could not open its local database
          </h1>
          <p className="mt-2 text-sm text-slate-700">
            Your existing browser data has not been deleted. Reload the page, or
            free device storage and try again.
          </p>
        </section>
      </main>,
    );
  }
}

void boot();
