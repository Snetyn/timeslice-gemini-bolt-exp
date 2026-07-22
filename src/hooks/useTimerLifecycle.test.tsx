import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reconcileAllTimers, checkpointPersistedTimers, flushAppStorage } =
  vi.hoisted(() => ({
    reconcileAllTimers: vi.fn(async () => []),
    checkpointPersistedTimers: vi.fn(async () => []),
    flushAppStorage: vi.fn(async () => undefined),
  }));

vi.mock("../data/timerRepository", () => ({
  reconcileAllTimers,
  checkpointPersistedTimers,
}));

vi.mock("../lib/storage", () => ({ flushAppStorage }));

import { useTimerLifecycle } from "./useTimerLifecycle";

function Harness({
  onElapsed,
  onCheckpoint,
}: {
  onElapsed: (seconds: number, observedAtMs: number) => void;
  onCheckpoint: (observedAtMs: number) => void;
}) {
  useTimerLifecycle({ enabled: true, onElapsed, onCheckpoint });
  return null;
}

describe("unified timer lifecycle", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    reconcileAllTimers.mockClear();
    checkpointPersistedTimers.mockClear();
    flushAppStorage.mockClear();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it("samples once before repeated foreground reconciliation", async () => {
    const onElapsed = vi.fn();
    const onCheckpoint = vi.fn();
    await act(async () => {
      root.render(
        <Harness onElapsed={onElapsed} onCheckpoint={onCheckpoint} />,
      );
    });
    expect(reconcileAllTimers).toHaveBeenCalledWith(1_000);

    vi.setSystemTime(3_500);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
    });

    expect(onElapsed).toHaveBeenCalledTimes(1);
    expect(onElapsed).toHaveBeenCalledWith(2, 3_500);
    expect(reconcileAllTimers).toHaveBeenLastCalledWith(3_500);
    expect(onCheckpoint).not.toHaveBeenCalled();
  });

  it("samples once and checkpoints the same timestamp on background events", async () => {
    const onElapsed = vi.fn();
    const onCheckpoint = vi.fn();
    await act(async () => {
      root.render(
        <Harness onElapsed={onElapsed} onCheckpoint={onCheckpoint} />,
      );
    });

    vi.setSystemTime(4_000);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(onElapsed).toHaveBeenCalledTimes(1);
    expect(onElapsed).toHaveBeenCalledWith(3, 4_000);
    expect(checkpointPersistedTimers).toHaveBeenCalledTimes(1);
    expect(checkpointPersistedTimers).toHaveBeenCalledWith(4_000);
    expect(onCheckpoint).toHaveBeenCalledWith(4_000);
    expect(flushAppStorage).toHaveBeenCalledTimes(1);
  });
});
