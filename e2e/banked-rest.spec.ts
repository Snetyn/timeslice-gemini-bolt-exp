import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const seedBankedRestWorkspace = async (
  page: Page,
  autoSchedule = false,
  bankGoalMinutes = 0,
) => {
  await page.addInitScript(
    ({ autoSchedule, bankGoalMinutes }) => {
      const activities = [
        {
          id: "focus",
          name: "Focus",
          color: "#2563eb",
          percentage: 75,
          duration: 90,
          timeRemaining: 5400,
          isCompleted: false,
          priority: false,
          tags: [],
        },
        {
          id: "chores",
          name: "Chores",
          color: "#14b8a6",
          percentage: 25,
          duration: 30,
          timeRemaining: 1800,
          isCompleted: false,
          priority: false,
          tags: [],
        },
      ];
      const flow = {
        availableRestTime: 0,
        relaxationVaultSeconds: 1800,
        totalEarnedToday: 1800,
        cycleCount: 0,
        isOnBreak: false,
        breakTimeRemaining: 0,
        initialBreakDuration: 0,
        lastResetDate: new Date().toDateString(),
        accumulatedFractionalTime: 0,
      };
      localStorage.setItem(
        "timeslice.state.v2",
        JSON.stringify({
          version: 2,
          values: {
            timeSliceActivities: JSON.stringify(activities),
            timeSliceFlowmodoro: JSON.stringify(flow),
            timeSliceSettings: JSON.stringify({
              flowmodoroAutoScheduleBankedRest: autoSchedule,
              flowmodoroBankGoalMinutes: bankGoalMinutes,
            }),
            timeSliceTotalHours: "2",
            timeSliceTotalMinutes: "0",
          },
        }),
      );
    },
    { autoSchedule, bankGoalMinutes },
  );
};

test("banked time schedules protected Rest without changing Session total", async ({
  page,
}) => {
  await seedBankedRestWorkspace(page);
  await page.goto("/");

  const rest = page.getByTestId("banked-rest-activity");
  await expect(rest).toContainText("Scheduled: 00:00");
  await expect(rest).toContainText("Available: 30:00");
  await expect(rest).toContainText("Total: 30:00");
  await rest.getByRole("button", { name: "Add time" }).click();
  await page.getByLabel("Rest minutes").fill("10");
  await page.getByLabel("Rest seconds").fill("0");
  await page.getByRole("button", { name: "Schedule rest" }).click();

  await expect(rest).toContainText("Scheduled: 10:00");
  await expect(rest).toContainText("Available: 20:00");
  await expect(rest).toContainText("Total: 30:00");
  await expect(page.getByLabel("Focus minutes")).toHaveValue("82.5");
  await expect(page.getByLabel("Chores minutes")).toHaveValue("27.5");
  await expect(page.getByText("Total: 100%")).toBeVisible();

  await page.getByRole("spinbutton", { name: "Hours:" }).fill("3");
  await expect(rest).toContainText("Scheduled: 10:00");
  await expect(page.getByLabel("Focus minutes")).toHaveValue("127.5");
  await expect(page.getByLabel("Chores minutes")).toHaveValue("42.5");

  await page.reload();
  await expect(page.getByTestId("banked-rest-activity")).toContainText(
    "Scheduled: 10:00",
  );
  await expect(page.getByTestId("banked-rest-activity")).toContainText(
    "Available: 20:00",
  );

  await rest.getByRole("button", { name: "Unschedule" }).click();
  await expect(rest).toContainText("Scheduled: 00:00");
  await expect(rest).toContainText("Available: 30:00");
  await expect(page.getByLabel("Focus minutes")).toHaveValue("135");
  await expect(page.getByLabel("Chores minutes")).toHaveValue("45");
});

test("auto-fill consumes only available donor time during setup", async ({
  page,
}) => {
  await seedBankedRestWorkspace(page, true);
  await page.goto("/");

  const rest = page.getByTestId("banked-rest-activity");
  await expect(rest).toContainText("Auto-fill is on");
  await expect(rest).toContainText("Scheduled: 30:00");
  await expect(rest).toContainText("Available: 00:00");
  await expect(rest).toContainText("Total: 30:00");
});

test("Bank goal caps auto-fill and display modes persist", async ({ page }) => {
  await seedBankedRestWorkspace(page, true, 10);
  await page.goto("/");
  await expect(page.getByTestId("banked-rest-activity")).toContainText(
    "Scheduled: 10:00",
  );
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator("#settings-section").selectOption("flow-rewards");
  await page.getByRole("button", { name: "Mirrored total" }).click();
  await page.getByRole("button", { name: "Back to TimeSlice" }).click();

  const rest = page.getByTestId("banked-rest-activity");
  await expect(rest).toContainText("Shared total: 30:00");
  await expect(rest).toContainText("Goal reached");

  await page.reload();
  await expect(page.getByTestId("banked-rest-activity")).toContainText(
    "Shared total: 30:00",
  );
});

test("reset removes scheduled Rest and restores its Session donors", async ({
  page,
}) => {
  await seedBankedRestWorkspace(page);
  await page.goto("/");
  const rest = page.getByTestId("banked-rest-activity");
  await rest.getByRole("button", { name: "Add time" }).click();
  await page.getByLabel("Rest minutes").fill("10");
  await page.getByRole("button", { name: "Schedule rest" }).click();

  await page.getByRole("tab", { name: "Flowmodoro" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset Bank" }).click();
  await page.getByRole("tab", { name: "Session" }).click();

  await expect(rest).toContainText("Scheduled: 00:00");
  await expect(rest).toContainText("Available: 00:00");
  await expect(page.getByLabel("Focus minutes")).toHaveValue("90");
  await expect(page.getByLabel("Chores minutes")).toHaveValue("30");
});
