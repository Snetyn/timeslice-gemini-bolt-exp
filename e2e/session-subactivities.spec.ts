import { expect, test } from "@playwright/test";

test("creates and persists a proportionally funded Session sub-activity", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "cleaning",
        name: "Cleaning",
        color: "hsl(220, 70%, 50%)",
        percentage: 33.333,
        duration: 5,
        timeRemaining: 300,
        isCompleted: false,
        countUp: false,
      },
      {
        id: "work",
        name: "Work",
        color: "hsl(280, 60%, 50%)",
        percentage: 66.667,
        duration: 10,
        timeRemaining: 600,
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
          timeSliceTotalMinutes: "15",
          timeSliceSettings: JSON.stringify({
            overtimeType: "none",
            vaultPredictionMode: "independent",
          }),
          timeSliceSessionState: JSON.stringify({
            isTimerActive: true,
            isPaused: false,
            currentActivityIndex: 0,
            sessionPlanFrozen: true,
            initialAllocatedSeconds: 900,
            lastActiveTimestamp: Date.now(),
          }),
        },
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();

  const predicted = page
    .getByText("Predicted End", { exact: true })
    .locator("..");
  const before = await predicted.textContent();
  await page
    .getByRole("button", { name: "Add sub-activity to Cleaning" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add sub-activity" });
  await dialog.getByLabel("Name").fill("Kitchen");
  await dialog.getByLabel("Sub-activity minutes").fill("2");
  await expect(dialog.getByText("Available from Cleaning")).toBeVisible();
  await expect(dialog.getByText("−2:00")).toBeVisible();
  await dialog.getByRole("button", { name: "Add 2:00" }).click();

  const child = page.locator('[data-parent-activity-id="cleaning"]');
  await expect(child).toContainText("Kitchen");
  await expect(
    page.locator('[data-testid="session-activity-cleaning"]'),
  ).toContainText(/3:00|03:00/);
  await expect(predicted).toHaveText(before || "");
  await page.reload();
  await expect(
    page.locator('[data-parent-activity-id="cleaning"]'),
  ).toContainText("Kitchen");
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("the sub-activity sheet rejects time beyond the parent's live maximum", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceActivities: JSON.stringify([
            {
              id: "parent",
              name: "Parent",
              color: "#2563eb",
              percentage: 50,
              duration: 1,
              timeRemaining: 60,
            },
            {
              id: "starred",
              name: "Protected",
              color: "#f59e0b",
              percentage: 50,
              duration: 1,
              timeRemaining: 60,
              priority: true,
            },
          ]),
          timeSliceTotalHours: "0",
          timeSliceTotalMinutes: "2",
        },
      }),
    );
  });
  await page.goto("/");
  await page
    .locator('[data-testid="session-activity-parent"]')
    .getByRole("button", { name: "Add sub-activity" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add sub-activity" });
  await dialog.getByLabel("Name").fill("Child");
  await dialog.getByLabel("Sub-activity minutes").fill("2");
  await expect(
    dialog.getByText("Available from Parent").locator(".."),
  ).toContainText("1:00");
  await expect(dialog.getByRole("button", { name: "Add 2:00" })).toBeDisabled();
});
