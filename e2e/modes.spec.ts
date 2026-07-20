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
