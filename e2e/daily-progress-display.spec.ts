import { expect, test } from "@playwright/test";

const seedLegacyDaily = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "work",
        name: "Work",
        color: "#ffffff",
        duration: 60,
        timeSpent: 15,
        timeSpentSeconds: 900,
        status: "scheduled",
        isActive: false,
        startedAt: null,
        subtasks: [],
        tags: [],
      },
      {
        id: "walk",
        name: "Walk",
        color: "hsl(120, 20%, 92%)",
        duration: 30,
        timeSpent: 0,
        timeSpentSeconds: 0,
        status: "scheduled",
        isActive: false,
        startedAt: null,
        subtasks: [],
        tags: [],
      },
      {
        id: "done",
        name: "Done task",
        color: "not-a-color",
        duration: 15,
        timeSpent: 15,
        timeSpentSeconds: 900,
        status: "completed",
        isActive: false,
        startedAt: null,
        subtasks: [],
        tags: [],
      },
    ];
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceDailyActivities: JSON.stringify(activities),
          timeSliceSettings: JSON.stringify({
            dailyPlannerVersion: "legacy",
            dailyProgressView: "linear",
            dailyHideCompleted: false,
            dailyTimelineAnimation: true,
            enableTimeWindowFiltering: false,
          }),
        },
      }),
    );
  });
};

test("Legacy Daily defaults to readable linear segments and remembers Circular", async ({
  page,
}) => {
  await seedLegacyDaily(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Daily" }).click();

  const work = page.getByTestId("daily-linear-segment-work");
  await expect(work).toBeVisible();
  await expect(work).not.toHaveAttribute("data-daily-color", "#ffffff");
  await expect(
    page.getByRole("list", { name: "Daily activity legend" }),
  ).toContainText("Work");

  await page.getByRole("button", { name: "circular" }).click();
  await expect(page.getByTestId("daily-circular-display")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Daily" }).click();
  await expect(page.getByTestId("daily-circular-display")).toBeVisible();
  await expect(page.getByRole("button", { name: "circular" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Legacy Daily exposes Full day and Hide completed without horizontal overflow", async ({
  page,
}) => {
  await seedLegacyDaily(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Daily" }).click();

  await page.getByRole("button", { name: "Full day" }).click();
  await expect(page.getByText(/Day utilization:/i)).toBeVisible();
  await page.getByLabel("Hide completed").check();
  await expect(
    page.getByRole("list", { name: "Daily activity legend" }),
  ).not.toContainText("Done task");
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
