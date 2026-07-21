import { expect, test } from "@playwright/test";

test("all TimeSlice modes are reachable from the primary workspace", async ({
  page,
}) => {
  await page.goto("/");

  const modes = ["Session", "Daily", "Single", "Flowmodoro"] as const;

  for (const mode of modes) {
    await page.locator(`button[aria-label="${mode}"]:visible`).first().click();
    await expect(
      page.getByRole("heading", { name: mode, exact: true }),
    ).toBeVisible();
  }
});

test("the mode workspace remains usable at a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Timer modes" }),
  ).toBeVisible();
  await page.locator('button[aria-label="Daily"]:visible').click();
  await expect(
    page.getByRole("heading", { name: "Daily", exact: true }),
  ).toBeVisible();
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390);
});

test("early-completion redistribution is configurable", async ({ page }) => {
  await page.goto("/");
  await page.locator('button[aria-label="Settings"]:visible').click();
  await page.locator("details.ts-advanced-settings > summary").click();

  const policy = page.locator("#early-completion-policy");
  await expect(policy).toBeVisible();
  await policy.selectOption("distribute");
  await expect(policy).toHaveValue("distribute");
});

test("appearance preferences preview immediately and persist after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('button[aria-label="Settings"]:visible').click();

  await page.getByRole("button", { name: "Dark" }).click();
  await page.getByRole("button", { name: "teal accent" }).click();
  await page.getByRole("button", { name: "Compact" }).click();
  await page.getByRole("button", { name: "Bar" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "teal");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await expect(page.locator(".ts-timer-variant-bar")).toBeVisible();

  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "teal");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
});

test("all active modes use the shared timer display language", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "focus",
        name: "Focus",
        color: "#2563eb",
        percentage: 60,
        duration: 6,
        timeRemaining: 360,
        isCompleted: false,
        countUp: false,
      },
      {
        id: "break",
        name: "Break",
        color: "#8b5cf6",
        percentage: 40,
        duration: 4,
        timeRemaining: 240,
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
          timeSliceTotalMinutes: "10",
        },
      }),
    );
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Start Session" }).click();
  await expect(page.locator(".ts-timer-display")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  await page.locator('button[aria-label="Daily"]:visible').click();
  await expect(page.locator(".ts-timer-display")).toBeVisible();

  await page.locator('button[aria-label="Single"]:visible').click();
  await page
    .getByPlaceholder("Enter a quick task or activity...")
    .fill("Design review");
  await page.getByRole("button", { name: "Start Activity" }).click();
  await expect(page.locator(".ts-timer-display")).toContainText(
    "Design review",
  );

  await page.locator('button[aria-label="Flowmodoro"]:visible').click();
  await expect(page.locator(".ts-timer-display")).toBeVisible();
});

test("session percentages, minutes and allocation slider stay synchronized", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const activities = [
      {
        id: "first",
        name: "First",
        color: "#6d28d9",
        percentage: 80,
        duration: 3,
        timeRemaining: 180,
        isCompleted: false,
        isLocked: false,
        countUp: false,
      },
      {
        id: "second",
        name: "Second",
        color: "#2dd4bf",
        percentage: 20,
        duration: 4,
        timeRemaining: 240,
        isCompleted: false,
        isLocked: false,
        countUp: false,
      },
    ];
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceActivities: JSON.stringify(activities),
          timeSliceTotalHours: "2",
          timeSliceTotalMinutes: "0",
          timeSliceSessionState: JSON.stringify({
            isTimerActive: false,
            isPaused: false,
            currentActivityIndex: 0,
            sessionPlanFrozen: true,
          }),
        },
      }),
    );
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Set Duration" }).click();
  await expect(page.locator("#hours")).toHaveValue("2");
  await expect(page.locator("#minutes")).toHaveValue("0");
  await expect(
    page.getByText(/Total session:/).filter({ hasText: "2h" }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "First minutes" }),
  ).toHaveValue("96");
  await expect(
    page.getByRole("spinbutton", { name: "Second minutes" }),
  ).toHaveValue("24");

  await page.getByRole("spinbutton", { name: "First percentage" }).fill("70");
  await expect(
    page.getByRole("spinbutton", { name: "First minutes" }),
  ).toHaveValue("84");
  await expect(
    page.getByRole("spinbutton", { name: "Second minutes" }),
  ).toHaveValue("36");

  const slider = page.getByTestId("allocation-slider");
  const box = await slider.boundingBox();
  if (!box) throw new Error("Allocation slider was not measurable");
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  await page.mouse.up();
  await expect(
    page.getByRole("spinbutton", { name: "First percentage" }),
  ).toHaveValue("60");
  await expect(
    page.getByRole("spinbutton", { name: "First minutes" }),
  ).toHaveValue("72");
});
