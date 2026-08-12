import { expect, test } from "@playwright/test";

test("Inbox occurrence is planned once and shared with Daily and Session", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Manage Activities and Tasks" })
    .click();
  await page.getByRole("button", { name: "+ Tag" }).click();
  const tagEditor = page.getByRole("dialog", { name: "Add tag" });
  await tagEditor.getByLabel("Name").fill("home focus");
  await tagEditor.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("#home focus", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "+ Task" }).click();
  const taskEditor = page.getByRole("dialog", { name: "Add task" });
  await taskEditor.getByLabel("Name").fill("Plan kitchen cleaning");
  await taskEditor.getByLabel("Estimate (minutes)").fill("35");
  await taskEditor.getByLabel("Date").fill(
    await page.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }),
  );
  await taskEditor.getByRole("button", { name: "#home focus" }).click();
  await taskEditor.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByText("Plan kitchen cleaning", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to Timer" }).click();

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
