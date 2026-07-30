import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  appStorageMock,
  listSessionReportsMock,
  saveSessionReportMock,
  getTimerMock,
  transitionTimerMock,
  confirmAllocationMock,
} = vi.hoisted(() => ({
  appStorageMock: {
    getItem: vi.fn((_key?: string) => null as string | null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    subscribeExternal: vi.fn(() => () => undefined),
    get hydrated() {
      return true;
    },
  },
  listSessionReportsMock: vi.fn(async () => []),
  saveSessionReportMock: vi.fn(async () => undefined),
  getTimerMock: vi.fn(async () => undefined),
  transitionTimerMock: vi.fn(async () => undefined),
  confirmAllocationMock: vi.fn(() => ({
    committed: true,
    preview: {
      activities: [],
      vaultAfterSeconds: 0,
      fingerprint: "",
      valid: true,
      requestedSeconds: 0,
      appliedSeconds: 0,
      unfundedSeconds: 0,
      changes: [],
      protectedOverrideRequired: false,
      request: {
        operation: "extra",
        activities: [],
        vaultSeconds: 0,
        sessionRevision: 0,
        requestedSeconds: 0,
        sourceId: "vault",
        targetId: "vault",
      },
      vaultBeforeSeconds: 0,
      error: undefined,
    },
  })),
}));

vi.mock("./lib/storage", () => ({
  appStorage: appStorageMock,
  flushAppStorage: vi.fn(async () => undefined),
}));

vi.mock("./data/timerRepository", () => ({
  listSessionReports: listSessionReportsMock,
  saveSessionReport: saveSessionReportMock,
  getTimer: getTimerMock,
  transitionTimer: transitionTimerMock,
}));

vi.mock("./data/sessionRunRepository", () => ({
  deleteSessionRun: vi.fn(async () => undefined),
  saveSessionRun: vi.fn(async () => undefined),
}));

vi.mock("./data/activitySessionRepository", () => ({
  applyActivitySessionTrace: vi.fn(),
  endActivitySession: vi.fn(),
  switchActivitySession: vi.fn(),
}));

vi.mock("./components/SessionReportModal", () => ({
  SessionReportModal: () => null,
}));

vi.mock("./components/ActivityHistoryModal", () => ({
  ActivityHistoryModal: () => null,
}));

vi.mock("./components/InsightsSheet", () => ({
  InsightsSheet: () => null,
}));

vi.mock("./components/ActivityManager", () => ({
  ActivityManager: () => null,
}));

vi.mock("./components/TimeAllocationDialog", () => ({
  TimeAllocationDialog: () => null,
}));

vi.mock("./components/DecisionCheckpoint", () => ({
  DecisionCheckpoint: () => null,
}));

vi.mock("./hooks/useTimerLifecycle", () => ({
  useTimerLifecycle: () => undefined,
}));

vi.mock("./hooks/useElapsedScheduler", () => ({
  useElapsedScheduler: () => undefined,
}));

vi.mock("./domain/timeAllocation", () => ({
  confirmAllocation: confirmAllocationMock,
}));

import App from "./App";

describe("App startup regression", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    window.localStorage.clear();
    appStorageMock.getItem.mockReset();
    appStorageMock.getItem.mockImplementation(() => null);
    appStorageMock.setItem.mockClear();
    appStorageMock.removeItem.mockClear();
    listSessionReportsMock.mockClear();
    saveSessionReportMock.mockClear();
    getTimerMock.mockClear();
    transitionTimerMock.mockClear();
    confirmAllocationMock.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("renders from a clean startup without throwing", async () => {
    await act(async () => {
      root.render(<App />);
    });

    expect(listSessionReportsMock).toHaveBeenCalledTimes(1);
  });

  it("shows separate Quick and Vault balances and refunds a stopped Vault Rest", async () => {
    const values = new Map<string, string>([
      [
        "timeSliceFlowmodoro",
        JSON.stringify({
          availableRestTime: 120,
          availableRestMinutes: 2,
          relaxationVaultSeconds: 1_200,
          relaxationVaultPeriodKey: "never",
          relaxationVaultExpiryPolicy: "never",
          totalEarnedToday: 1_320,
          cycleCount: 0,
          isOnBreak: false,
          breakTimeRemaining: 0,
          initialBreakDuration: 0,
          lastResetDate: new Date().toDateString(),
          accumulatedFractionalTime: 0,
        }),
      ],
    ]);
    appStorageMock.getItem.mockImplementation(
      (key?: string) => values.get(key || "") ?? null,
    );

    await act(async () => {
      root.render(<App />);
    });
    const flowTab = Array.from(
      host.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((button) => button.textContent?.includes("Flowmodoro"));
    expect(flowTab).toBeTruthy();
    await act(async () => flowTab?.click());

    expect(host.textContent).toContain("Quick Break");
    expect(host.textContent).toContain("Relaxation Vault");
    expect(host.textContent).toContain("20:00");

    const vaultRest = Array.from(
      host.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.trim() === "Vault Rest");
    await act(async () => vaultRest?.click());
    expect(host.textContent).toContain("Vault Rest · activities postponed");

    const stop = Array.from(
      host.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) =>
      button.textContent?.includes("Stop & return unused time"),
    );
    await act(async () => stop?.click());
    expect(host.textContent).toContain("20:00");
  });
});
