import { expect, test, type Page } from "@playwright/test";

async function seedShortSession(page: Page) {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "focus",
        name: "Focus",
        color: "#38bdf8",
        percentage: 60,
        duration: 1.2,
        timeRemaining: 72,
        isCompleted: false,
        countUp: false,
      },
      {
        id: "break",
        name: "Break",
        color: "#8b5cf6",
        percentage: 40,
        duration: 0.8,
        timeRemaining: 48,
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
          timeSliceTotalMinutes: "2",
          timeSliceSettings: JSON.stringify({
            showSessionEndReport: true,
            sessionReportView: "summary",
          }),
        },
      }),
    );
  });
}

async function finishSeededSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Session" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("checkbox", { name: "Complete Focus" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("checkbox", { name: "Complete Break" }).click();
  await expect(
    page.getByRole("dialog", { name: "Session Report" }),
  ).toBeVisible();
}

test("session report switches to the task wheel and persists the choice", async ({
  page,
}) => {
  await seedShortSession(page);
  await finishSeededSession(page);

  await expect(page.getByRole("tab", { name: "Summary" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Task wheel" }).click();
  await expect(page.getByRole("tab", { name: "Task wheel" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("img", { name: /Outer ring shows.*planned/i }),
  ).toBeVisible();
  await expect(page.getByText("Outer: Plan")).toBeVisible();
  await expect(page.getByText("Inner: Actual")).toBeVisible();
  await expect(page.getByLabel("Task wheel legend")).toContainText("Focus");
  await expect(page.getByLabel("Task wheel legend")).toContainText("Break");

  await page.waitForTimeout(400);
  const savedView = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("timeslice");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<{ value?: unknown } | undefined>(
      (resolve, reject) => {
        const request = database
          .transaction("settings", "readonly")
          .objectStore("settings")
          .get("current");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );
    database.close();
    const settings =
      typeof record?.value === "string"
        ? JSON.parse(record.value)
        : record?.value;
    return settings?.sessionReportView;
  });
  expect(savedView).toBe("tasks");

  const history = page.getByText(/Recent sessions \(1\)/);
  await expect(history).toBeVisible();
  await history.click();
  await page
    .locator("details")
    .filter({ hasText: /Recent sessions/ })
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByLabel("Task wheel legend")).toBeVisible();
});

test("task wheel fits Android portrait widths without horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await seedShortSession(page);
  await finishSeededSession(page);
  await page.getByRole("tab", { name: "Task wheel" }).click();

  const dialog = page.getByRole("dialog", { name: "Session Report" });
  await expect(dialog).toBeVisible();
  const dimensions = await dialog.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.getByRole("button", { name: "Done" })).toBeAttached();
  await page.screenshot({
    path: testInfo.outputPath("task-wheel-android.png"),
    fullPage: false,
  });
});
