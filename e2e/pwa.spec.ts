import { expect, test } from "@playwright/test";

test("production shell installs a generated service worker and works offline", async ({
  context,
  page,
}) => {
  await page.goto("/");
  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifestHref).toMatch(/manifest\.webmanifest$/);

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are unavailable");
    }
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByText("TimeSlice", { exact: true })).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("TimeSlice", { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test("Android workspaces never overflow horizontally", async ({ page }) => {
  await page.goto("/");
  for (const mode of ["Session", "Daily", "Single", "Flowmodoro"]) {
    await page.getByRole("tab", { name: mode, exact: true }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
