import { expect, test } from "@playwright/test";

test("all TimeSlice modes are reachable from the primary workspace", async ({
  page,
}) => {
  await page.goto("/");

  const modes = [
    ["Session", /Session Duration/i],
    ["Daily", /Daily Progress/i],
    ["Single", /Single Activity Mode/i],
    ["Flowmodoro", /Flowmodoro Mode/i],
  ] as const;

  for (const [mode, expectedHeading] of modes) {
    await page.getByRole("tab", { name: mode }).click();
    await expect(
      page.getByRole("heading", { name: expectedHeading }),
    ).toBeVisible();
  }
});

test("the mode workspace remains usable at a mobile viewport", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("tablist", { name: "TimeSlice mode" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Daily" }).click();
  await expect(
    page.getByRole("heading", { name: /Daily Progress/i }),
  ).toBeVisible();
});

test("early-completion redistribution is configurable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const policy = page.locator("#early-completion-policy");
  await expect(policy).toBeVisible();
  await policy.selectOption("distribute");
  await expect(policy).toHaveValue("distribute");
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
