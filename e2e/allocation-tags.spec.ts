import { expect, test } from "@playwright/test";

test("running Session allocation keeps input focus and can reactivate a completed task", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "focus",
        name: "Focus",
        color: "#2563eb",
        percentage: 100,
        duration: 10,
        timeRemaining: 600,
        isCompleted: false,
        countUp: false,
      },
      {
        id: "done",
        name: "Done",
        color: "#7c3aed",
        percentage: 0,
        duration: 2,
        timeRemaining: 0,
        isCompleted: true,
        completedElapsedSeconds: 120,
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
          timeSliceTotalMinutes: "10",
          timeSliceSettings: JSON.stringify({
            overtimeType: "none",
            vaultPredictionMode: "independent",
          }),
          timeSliceSessionState: JSON.stringify({
            isTimerActive: true,
            isPaused: false,
            currentActivityIndex: 0,
            sessionPlanFrozen: true,
            initialAllocatedSeconds: 600,
            lastActiveTimestamp: Date.now(),
          }),
        },
      }),
    );
  });
  await page.goto("/");

  const predicted = page
    .getByText("Predicted End", { exact: true })
    .locator("..");
  const before = await predicted.textContent();
  await page
    .getByRole("button", { name: "Transfer time to vault" })
    .first()
    .click();
  const minutes = page.getByRole("textbox", { name: "Minutes" });
  await minutes.fill("1");
  const seconds = page.getByRole("textbox", { name: "Seconds" });
  await seconds.fill("0");
  await expect(seconds).toBeFocused();
  await page.waitForTimeout(1_200);
  await expect(seconds).toBeFocused();
  await expect(minutes).toHaveValue("1");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(predicted).toHaveText(before || "");

  await page.getByRole("button", { name: "Give time to Done" }).click();
  await page.getByRole("textbox", { name: "Minutes" }).fill("1");
  await page.getByRole("textbox", { name: "Seconds" }).fill("0");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(
    page.getByRole("button", { name: "Give time to Done" }),
  ).toHaveCount(0);
  await expect(predicted).toHaveText(before || "");
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("Use all follows a running activity and transfers its live maximum", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "focus",
        name: "Focus",
        color: "#2563eb",
        percentage: 50,
        duration: 10,
        timeRemaining: 600,
        isCompleted: false,
        countUp: false,
      },
      {
        id: "backup",
        name: "Backup",
        color: "#14b8a6",
        percentage: 50,
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
          timeSliceTotalMinutes: "20",
          timeSliceSettings: JSON.stringify({
            overtimeType: "none",
            vaultPredictionMode: "independent",
          }),
          timeSliceSessionState: JSON.stringify({
            isTimerActive: true,
            isPaused: false,
            currentActivityIndex: 0,
            sessionPlanFrozen: true,
            initialAllocatedSeconds: 1200,
            lastActiveTimestamp: Date.now(),
          }),
        },
      }),
    );
  });
  await page.goto("/");

  const predicted = page
    .getByText("Predicted End", { exact: true })
    .locator("..");
  const predictedBefore = await predicted.textContent();
  await page
    .getByRole("button", { name: "Transfer time to vault" })
    .first()
    .click();
  const useAll = page.getByRole("button", { name: /Use all/ });
  await useAll.click();
  await expect(useAll).toHaveAttribute("aria-pressed", "true");
  const selectedAt = await useAll.textContent();
  await page.waitForTimeout(1_200);
  await expect(useAll).not.toHaveText(selectedAt || "");
  await expect(page.getByText("Unfunded", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("checkbox", { name: "Complete Focus" }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Give time to Focus" }),
  ).toBeVisible();
  await expect(predicted).toHaveText(predictedBefore || "");
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("Daily tag ratios keep tasks visible and persist controls without persisting selection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const daily = [
      {
        id: "shared",
        name: "Shared",
        color: "#7c3aed",
        duration: 30,
        timeSpentSeconds: 600,
        status: "scheduled",
        isActive: false,
        startedAt: null,
        tags: ["1", "2"],
      },
      {
        id: "work",
        name: "Work only",
        color: "#2563eb",
        duration: 20,
        timeSpentSeconds: 300,
        status: "scheduled",
        isActive: false,
        startedAt: null,
        tags: ["1"],
      },
    ];
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceDailyActivities: JSON.stringify(daily),
        },
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Daily" }).click();
  const panel = page.getByTestId("daily-tag-ratio-panel");
  await panel.getByRole("button", { name: "Work" }).click();
  await panel.getByRole("button", { name: "Health" }).click();
  await expect(panel.getByTestId("tag-ratio-donut")).toBeVisible();
  await expect(panel.getByText("70%", { exact: true })).toBeVisible();
  await expect(panel.getByText("30%", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit tags for Shared" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit tags for Work only" }),
  ).toBeVisible();

  await panel.getByRole("button", { name: "all" }).click();
  await panel.getByRole("button", { name: "actual" }).click();
  await panel.getByRole("button", { name: "Radar" }).click();
  await expect(panel.getByText(/Select at least three tags/)).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Daily" }).click();
  const reloaded = page.getByTestId("daily-tag-ratio-panel");
  await expect(reloaded.getByText(/Select one or more tags/)).toBeVisible();
  await reloaded.getByRole("button", { name: "Work" }).click();
  await expect(reloaded.getByRole("button", { name: "Radar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    reloaded.getByRole("button", { name: "actual" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(reloaded.getByRole("button", { name: "all" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("Session tag ratios are chart-only in setup and running views", async ({
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
              id: "focus",
              name: "Focus",
              color: "#2563eb",
              percentage: 50,
              duration: 10,
              timeRemaining: 600,
              tags: ["1"],
            },
            {
              id: "move",
              name: "Move",
              color: "#10b981",
              percentage: 50,
              duration: 10,
              timeRemaining: 600,
              tags: ["2"],
            },
          ]),
          timeSliceTotalHours: "0",
          timeSliceTotalMinutes: "20",
        },
      }),
    );
  });
  await page.goto("/");
  const setupPanel = page.getByTestId("session-tag-ratio-panel");
  await setupPanel.getByRole("button", { name: "Work" }).click();
  await expect(setupPanel.getByTestId("tag-ratio-donut")).toBeVisible();
  await expect(page.getByTestId("session-activity-focus")).toBeVisible();
  await expect(page.getByTestId("session-activity-move")).toBeVisible();
  await page.getByRole("button", { name: /Start Session/ }).click();
  const runningPanel = page.getByTestId("session-tag-ratio-panel");
  await expect(runningPanel.getByTestId("tag-ratio-donut")).toBeVisible();
  await expect(page.getByTestId("session-activity-focus")).toBeVisible();
  await expect(page.getByTestId("session-activity-move")).toBeVisible();
});
