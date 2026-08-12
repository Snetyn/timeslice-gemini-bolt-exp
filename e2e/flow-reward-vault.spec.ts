import { expect, test, type Page } from "@playwright/test";

const seedRewardBalances = async (page: Page) => {
  await page.addInitScript(() => {
    const now = new Date();
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceFlowmodoro: JSON.stringify({
            availableRestTime: 120,
            availableRestMinutes: 2,
            relaxationVaultSeconds: 1_200,
            relaxationVaultPeriodKey: "never",
            relaxationVaultExpiryPolicy: "never",
            totalEarnedToday: 1_320,
            cycleCount: 0,
            isOnBreak: false,
            breakTimeRemaining: 0,
            initialBreakDuration: 0,
            lastResetDate: now.toDateString(),
            accumulatedFractionalTime: 0,
          }),
        },
      }),
    );
  });
};

test("Quick and Vault breaks stay explicit and survive reload", async ({
  page,
}) => {
  await seedRewardBalances(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Flowmodoro" }).click();

  await expect(page.getByText("Reward Bank", { exact: true })).toBeVisible();
  await expect(page.getByText("20:00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Custom Vault Rest" }).click();
  const minutes = page.getByLabel("Minutes");
  await minutes.fill("1");
  await expect(minutes).toBeFocused();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    page.getByText(/Vault Rest · activities postponed/i),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Flowmodoro" }).click();
  await expect(
    page.getByText(/Vault Rest · activities postponed/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop & return unused time" }).click();
  await expect(page.getByText("Reward Bank", { exact: true })).toBeVisible();
});

test("Vault settings persist and the Flow screen does not overflow Android", async ({
  page,
}) => {
  await seedRewardBalances(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator("#settings-section").selectOption("flow-rewards");
  await page.locator("#flow-vault-max").fill("180");
  await page.locator("#flow-vault-expiry").selectOption("weekly");
  await page.getByRole("button", { name: "Continue activities" }).click();
  await page.getByRole("button", { name: "Back to TimeSlice" }).click();

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator("#settings-section").selectOption("flow-rewards");
  await expect(page.locator("#flow-vault-max")).toHaveValue("180");
  await expect(page.locator("#flow-vault-expiry")).toHaveValue("weekly");
  await page.getByRole("button", { name: "Back to TimeSlice" }).click();
  await page.getByRole("tab", { name: "Flowmodoro" }).click();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
