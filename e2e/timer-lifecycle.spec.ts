import { expect, test, type Page } from "@playwright/test";

const displayedSeconds = async (locator: ReturnType<Page["locator"]>) => {
  const text = (await locator.textContent())?.trim() || "";
  const parts = text.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid timer text: ${text}`);
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
};

const timerRevision = (page: Page, id: string) =>
  page.evaluate(
    (timerId) =>
      new Promise<number | undefined>((resolve, reject) => {
        const request = indexedDB.open("timeslice");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("timers", "readonly");
          const get = transaction.objectStore("timers").get(timerId);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => resolve(get.result?.value?.revision);
        };
      }),
    id,
  );

const timerState = (page: Page, id: string) =>
  page.evaluate(
    (timerId) =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const request = indexedDB.open("timeslice");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("timers", "readonly");
          const get = transaction.objectStore("timers").get(timerId);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => resolve(get.result?.value);
        };
      }),
    id,
  );

const activitySessionRecords = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const request = indexedDB.open("timeslice");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("activitySessions", "readonly");
          const get = transaction.objectStore("activitySessions").getAll();
          get.onerror = () => reject(get.error);
          get.onsuccess = () => resolve(get.result);
        };
      }),
  );

test("a running Session catches up once across an Android reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "focus",
        name: "Focus",
        color: "#2563eb",
        percentage: 100,
        duration: 1,
        timeRemaining: 12,
        isCompleted: false,
        countUp: false,
      },
    ];
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceActivities: JSON.stringify(activities),
          timeSliceTotalHours: "0",
          timeSliceTotalMinutes: "1",
          timeSliceSessionState: JSON.stringify({
            isTimerActive: true,
            isPaused: false,
            currentActivityIndex: 0,
            sessionPlanFrozen: true,
            initialAllocatedSeconds: 60,
            lastActiveTimestamp: Date.now() - 4_000,
          }),
        },
      }),
    );
  });

  await page.goto("/");
  const timer = page.getByLabel("Current activity time");
  await expect(timer).toBeVisible();
  const afterRecovery = await displayedSeconds(timer);
  expect(afterRecovery).toBeGreaterThanOrEqual(6);
  expect(afterRecovery).toBeLessThanOrEqual(8);

  await page.waitForTimeout(1_200);
  await page.reload();
  const afterReload = await displayedSeconds(
    page.getByLabel("Current activity time"),
  );
  expect(afterReload).toBeLessThan(afterRecovery);
  expect(afterRecovery - afterReload).toBeLessThanOrEqual(3);
  await expect
    .poll(async () =>
      (await activitySessionRecords(page)).filter(
        (record) => record.sourceTimerId === "session" && record.status === "running",
      ).length,
    )
    .toBe(1);
});

test("an automatic Session switch closes and orders activity records", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "short",
        name: "Short",
        color: "#2563eb",
        percentage: 50,
        duration: 1,
        timeRemaining: 1,
        isCompleted: false,
        countUp: false,
      },
      {
        id: "next",
        name: "Next",
        color: "#7c3aed",
        percentage: 50,
        duration: 1,
        timeRemaining: 20,
        isCompleted: false,
        countUp: false,
      },
    ];
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceActivities: JSON.stringify(activities),
          timeSliceTotalHours: "0",
          timeSliceTotalMinutes: "0.04",
          timeSliceSettings: JSON.stringify({ overtimeType: "none" }),
        },
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start Session" }).click();

  await expect
    .poll(async () => {
      const records = await activitySessionRecords(page);
      return records
        .map((record) => [record.activityId, record.status])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
    })
    .toEqual([
      ["next", "running"],
      ["short", "completed"],
    ]);
});

test("Single pause survives reload and ordinary ticks do not write IndexedDB", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Single", exact: true }).click();
  await page
    .getByPlaceholder("Enter a quick task or activity...")
    .fill("Pause test");
  await page.getByRole("button", { name: "Start Activity" }).click();
  await expect.poll(() => timerRevision(page, "single")).toBeDefined();
  const startedRevision = await timerRevision(page, "single");
  await expect
    .poll(async () => (await activitySessionRecords(page))[0]?.status)
    .toBe("running");
  const recordingRevision = (await activitySessionRecords(page))[0]?.revision;

  await page.waitForTimeout(2_100);
  expect(await timerRevision(page, "single")).toBe(startedRevision);
  expect((await activitySessionRecords(page))[0]?.revision).toBe(
    recordingRevision,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const pausedAt = await displayedSeconds(
    page.getByLabel("Single activity elapsed time"),
  );
  await expect
    .poll(() => timerRevision(page, "single"))
    .not.toBe(startedRevision);
  await expect
    .poll(async () => (await activitySessionRecords(page))[0]?.status)
    .toBe("completed");

  await page.waitForTimeout(1_200);
  expect(
    await displayedSeconds(page.getByLabel("Single activity elapsed time")),
  ).toBe(pausedAt);

  await page.reload();
  await page.getByRole("tab", { name: "Single", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  expect(
    await displayedSeconds(page.getByLabel("Single activity elapsed time")),
  ).toBe(pausedAt);

  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.waitForTimeout(1_200);
  expect(
    await displayedSeconds(page.getByLabel("Single activity elapsed time")),
  ).toBeGreaterThan(pausedAt);
});

test("Daily switches ownership instead of running two activities", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Daily", exact: true }).click();

  await page.getByText("Work", { exact: true }).last().click();
  await expect
    .poll(async () => (await timerState(page, "daily:work-1"))?.status)
    .toBe("running");

  await page.getByText("Exercise", { exact: true }).last().click();
  await expect
    .poll(async () => (await timerState(page, "daily:work-1"))?.status)
    .toBe("paused");
  await expect
    .poll(async () => (await timerState(page, "daily:exercise-1"))?.status)
    .toBe("running");
  await expect
    .poll(async () => {
      const records = await activitySessionRecords(page);
      return records
        .map((record) => [record.activityId, record.status])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
    })
    .toEqual([
      ["exercise-1", "running"],
      ["work-1", "completed"],
    ]);

  await page.reload();
  expect((await timerState(page, "daily:work-1"))?.status).toBe("paused");
  expect((await timerState(page, "daily:exercise-1"))?.status).toBe(
    "running",
  );
});

test("a view-only window receives live Session state and can take control", async ({
  context,
  page,
}) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceActivities: JSON.stringify([
            {
              id: "shared-focus",
              name: "Shared focus",
              color: "#7c3aed",
              percentage: 100,
              duration: 1,
              timeRemaining: 60,
              isCompleted: false,
              countUp: false,
            },
          ]),
          timeSliceTotalHours: "0",
          timeSliceTotalMinutes: "1",
        },
      }),
    );
  });
  await page.goto("/");
  const viewer = await context.newPage();
  await viewer.goto("/");
  await expect(viewer.getByText(/window is view-only/i)).toBeVisible();

  await page.getByRole("button", { name: "Start Session" }).click();
  await expect(viewer.getByLabel("Current activity time")).toBeVisible();

  await page.close();
  await viewer.getByRole("button", { name: "Take control" }).click();
  await expect(viewer.getByText(/window is view-only/i)).toBeHidden();
});
