import { expect, test } from "@playwright/test";

test("Inbox occurrence is planned once and shared with Daily and Session", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Manage Activities and Tasks" })
    .click();
  await page.getByRole("button", { name: "Tags", exact: true }).click();
  await page.getByPlaceholder("New tag").fill("home focus");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("#home focus", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await page
    .getByPlaceholder("What needs doing?")
    .fill("Plan kitchen cleaning");
  await page.getByLabel("Estimate").fill("35");
  await page.getByRole("button", { name: "home focus", exact: true }).click();
  await page.getByRole("button", { name: "One-off" }).click();
  await expect(
    page.getByText("Plan kitchen cleaning", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Plan today" }).click();
  await page.getByRole("button", { name: "Close Tasks" }).click();

  await page.getByRole("tab", { name: "Daily", exact: true }).click();
  await page.getByRole("button", { name: "Set up" }).click();
  await expect(
    page.getByRole("heading", { name: "Set your normal usable day" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enable shared Daily planner" })
    .click();
  await expect(page.getByTestId("tasks-daily-planner")).toContainText(
    "Plan kitchen cleaning",
  );
  await expect(
    page.getByRole("article").getByText("35m", { exact: true }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Session", exact: true }).click();
  await page.getByRole("button", { name: "Add from Tasks" }).click();
  await page.getByRole("button", { name: /Plan kitchen cleaning/ }).click();
  await expect(
    page.locator('input[value="Plan kitchen cleaning"]'),
  ).toBeVisible();

  const width = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(width).toBeLessThanOrEqual(1);
});

test("legacy Daily stays selected until onboarding is explicitly completed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Daily", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily Progress" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Set up" })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Daily", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily Progress" }),
  ).toBeVisible();
});
