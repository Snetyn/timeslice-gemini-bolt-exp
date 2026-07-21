import { beforeEach, describe, expect, it } from "vitest";
import { migrateLegacyStorage } from "./migrateLegacy";
import { TimeSliceDatabase } from "./timesliceDb";
import { STORAGE_KEY } from "../lib/storage";

describe("legacy migration", () => {
  let db: TimeSliceDatabase;

  beforeEach(async () => {
    window.localStorage.clear();
    db = new TimeSliceDatabase(`migration-${crypto.randomUUID()}`);
    await db.open();
  });

  it("uses the v2 envelope before an older key and preserves raw sources", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        values: { timeSliceSettings: '{"from":"v2"}' },
      }),
    );
    window.localStorage.setItem("timeSliceSettings", '{"from":"legacy"}');
    await migrateLegacyStorage(db);

    expect((await db.settings.get("current"))?.value).toBe('{"from":"v2"}');
    expect((await db.meta.get("legacy-import-v1-raw"))?.value).toMatchObject({
      timeSliceSettings: '{"from":"legacy"}',
    });
  });

  it("keeps a legacy active session without replaying an unknown old gap", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        values: {
          timeSliceSessionState: JSON.stringify({
            isTimerActive: true,
            isPaused: false,
            lastActiveTimestamp: 1,
          }),
          timeSliceActivities: JSON.stringify([
            { id: "work", timeRemaining: 30 },
          ]),
        },
      }),
    );
    await migrateLegacyStorage(db);
    const session = await db.timers.get("session");
    expect(session?.value.status).toBe("running");
    expect(session?.value.accumulatedMs).toBe(0);
    expect(session?.value.startedAtMs).toBeGreaterThan(1);
  });
});
