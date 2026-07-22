import { expect, test } from "@playwright/test";

test("records, corrects, removes and restores a Single activity interval", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Single", exact: true }).click();
  await page
    .getByPlaceholder("Enter a quick task or activity...")
    .fill("History test");
  await page.getByRole("button", { name: "Start Activity" }).click();
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await page.getByRole("button", { name: "History", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Activity history" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("History test", { exact: true })).toBeVisible();
  await expect(dialog.getByText("single", { exact: false })).toBeVisible();

  await dialog.getByRole("button", { name: "Correct" }).click();
  await dialog
    .getByRole("textbox", { name: "Activity", exact: true })
    .fill("Corrected history");
  await dialog.getByLabel("Duration (minutes)").fill("2");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(
    dialog.getByText("Corrected history", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("2m 0s", { exact: true })).toBeVisible();

  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog.getByRole("button", { name: "Remove" }).click();
  await expect(
    dialog.getByText("Corrected history", { exact: true }),
  ).toBeHidden();

  await dialog.getByLabel("Show removed").check();
  await expect(
    dialog.getByText("Corrected history", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Restore" }).click();
  await dialog.getByLabel("Show removed").uncheck();
  await expect(
    dialog.getByText("Corrected history", { exact: true }),
  ).toBeVisible();
});
