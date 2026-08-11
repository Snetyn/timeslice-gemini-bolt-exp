import { expect, test } from "@playwright/test";

test("Free Flow creates, times, classifies, and records a nested action", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("tab", { name: "Free Flow" }).click();
  await page.getByRole("button", { name: "Start blank run" }).click();
  await page.getByPlaceholder("Add an action…").fill("Clean kitchen");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("button", { name: "Add child to Clean kitchen" })
    .click();
  const childEditor = page.getByPlaceholder("Sub-action").locator("..");
  await childEditor.getByRole("textbox").fill("Wash dishes");
  await childEditor.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    page.getByText("Wash dishes", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("suggested Quick");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Quick$/ })
    .click();
  await page.getByRole("button", { name: "Confirm completion" }).click();
  await expect(page.getByText(/Save “Wash dishes”/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("global Quick Action uses a single focused timer and stays within mobile width", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a Quick Action" }).click();
  await page.getByPlaceholder("What can you finish now?").fill("Put cup away");
  await page.getByRole("button", { name: "Start Quick Action" }).click();
  await expect(
    page.getByText("Put cup away", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm completion" }).click();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
