import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ALERT_PREFERENCES,
  type AlertTimerSnapshot,
} from "../domain/alerts";
import {
  deleteAlertCursor,
  getAlertCursor,
  saveAlertCursor,
} from "./alertRepository";
import { timeSliceDb } from "./timesliceDb";

const snapshot: AlertTimerSnapshot = {
  timerKey: "session:focus",
  mode: "session",
  status: "running",
  observedAtMs: 1_000,
  elapsedSeconds: 10,
  remainingSeconds: 50,
  overtimeSeconds: 0,
};

describe("alert cursor repository", () => {
  beforeEach(async () => {
    await timeSliceDb.delete();
    await timeSliceDb.open();
  });

  it("stores cursors in meta without changing database version", async () => {
    await saveAlertCursor(snapshot, DEFAULT_ALERT_PREFERENCES, ["one"], "save");
    expect(
      (await getAlertCursor(snapshot.timerKey))?.deliveredEventIds,
    ).toEqual(["one"]);
    expect(timeSliceDb.verno).toBe(5);
  });

  it("replays stable mutations without duplicating cursor state", async () => {
    const first = await saveAlertCursor(
      snapshot,
      DEFAULT_ALERT_PREFERENCES,
      ["one"],
      "stable",
    );
    const second = await saveAlertCursor(
      snapshot,
      DEFAULT_ALERT_PREFERENCES,
      ["one"],
      "stable",
    );
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
  });

  it("removes terminal cursors explicitly", async () => {
    await saveAlertCursor(snapshot, DEFAULT_ALERT_PREFERENCES, [], "save");
    await deleteAlertCursor(snapshot.timerKey, "delete");
    expect(await getAlertCursor(snapshot.timerKey)).toBeNull();
  });
});
