import { expect, test, type Page } from "@playwright/test";

async function seedRewardSession(page: Page) {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "focus",
        name: "Focus",
        color: "#2563eb",
        percentage: 50,
        duration: 105,
        timeRemaining: 6_300,
        isCompleted: false,
        priority: false,
        tags: [],
      },
      {
        id: "chores",
        name: "Chores",
        color: "#14b8a6",
        percentage: 50,
        duration: 105,
        timeRemaining: 6_300,
        isCompleted: false,
        priority: false,
        tags: [],
      },
    ];
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceActivities: JSON.stringify(activities),
          timeSliceTotalHours: "3",
          timeSliceTotalMinutes: "30",
          timeSliceSettings: JSON.stringify({
            progressView: "linear",
            progressBarStyle: "segmented",
            flowmodoroEnabled: true,
            flowmodoroQuickReserveMinutes: 10,
          }),
        },
      }),
    );
  });
}

test("reserved Session Reward Goal starts empty and unlocks from focused work", async ({
  page,
}) => {
  await seedRewardSession(page);
  await page.goto("/");
  await page.getByLabel("Enable Session Reward Goal").check();
  await page.getByLabel("Reward Rest goal (minutes)").fill("60");

  await expect(page.getByText("2.50 work : 1 rest")).toBeVisible();
  await expect(page.getByText("Focused work").locator("..")).toContainText(
    "2:30:00",
  );
  await page.getByRole("button", { name: "Start Session" }).click();

  await expect(page.getByText(/Quick Reserve is paused/i)).toBeVisible();
  const rewardRow = page.getByTestId("session-activity-timeslice-banked-rest");
  await expect(rewardRow).toContainText("Reward Rest");
  await expect(rewardRow).toContainText(/available.*goal/i);
  await expect(rewardRow).toContainText("locked");
  await page.waitForTimeout(3_200);
  await expect(rewardRow).not.toContainText("00:00 available");

  await page.reload();
  await expect(
    page.getByTestId("session-activity-timeslice-banked-rest"),
  ).toContainText(/available.*goal/i);
});

test("Live fill keeps the target visible and Reset restores the original plan", async ({
  page,
}) => {
  await seedRewardSession(page);
  await page.goto("/");
  await page.getByLabel("Enable Session Reward Goal").check();
  await page.getByLabel("Reward Rest goal (minutes)").fill("60");
  await page.getByRole("radio", { name: "Live fill" }).click();
  await page.getByRole("button", { name: "Start Session" }).click();
  await expect(
    page.getByTestId("session-activity-timeslice-banked-rest"),
  ).toContainText(/1:00:00 goal/);

  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: /Reset/ }).click();
  await expect(page.getByLabel("Enable Session Reward Goal")).not.toBeChecked();
  await expect(page.getByLabel("Focus minutes")).toHaveValue("105");
  await expect(page.getByLabel("Chores minutes")).toHaveValue("105");
});
