import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const seedWorkspace = async (page: Page) => {
  await page.addInitScript(() => {
    const session = [
      {
        id: "session-focus",
        sharedId: "shared-focus",
        name: "Focus",
        color: "#2563eb",
        percentage: 100,
        duration: 60,
        timeRemaining: 3600,
        isCompleted: false,
        tags: [],
      },
    ];
    const daily = [
      {
        id: "daily-focus",
        sharedId: "shared-focus",
        name: "Focus",
        color: "#2563eb",
        duration: 60,
        status: "scheduled",
        isActive: false,
        timeSpent: 0,
        startedAt: null,
        tags: [],
      },
    ];
    const rpgTags = [
      {
        id: "work-id",
        name: "Work",
        color: "#7c3aed",
        createdAt: new Date().toISOString(),
      },
      null,
      { id: "broken" },
    ];
    localStorage.setItem(
      "timeslice.state.v2",
      JSON.stringify({
        version: 2,
        values: {
          timeSliceActivities: JSON.stringify(session),
          timeSliceDailyActivities: JSON.stringify(daily),
          timeSliceRPGTags: JSON.stringify(rpgTags),
          timeSliceCustomTags: JSON.stringify(["home", null, { bad: true }]),
          timeSliceActivityTemplates: JSON.stringify([
            {
              id: "focus-template",
              name: "Focus",
              color: "#2563eb",
              tags: [null, "home"],
            },
          ]),
          timeSliceTotalHours: "1",
          timeSliceTotalMinutes: "0",
        },
      }),
    );
  });
};

test("quick tags stay responsive and synchronize shared Session/Daily rows", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await seedWorkspace(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Edit tags for Focus" }).click();
  const work = page.getByRole("checkbox", { name: "Work" });
  await expect(work).toHaveAttribute("aria-checked", "false");
  await work.click();
  await expect(work).toHaveAttribute("aria-checked", "true");

  const search = page.getByRole("textbox", { name: "Search or create tag" });
  await search.fill("chores");
  await page.getByRole("button", { name: /Create “chores”/ }).click();
  await page.getByRole("button", { name: "Close tag picker" }).click();

  await page.getByRole("tab", { name: "Daily" }).click();
  await page.getByRole("button", { name: "Edit tags for Focus" }).click();
  await expect(page.getByRole("checkbox", { name: "Work" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("checkbox", { name: "chores" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "Close tag picker" }).click();
  await page.waitForTimeout(350);
  await page.reload();
  await page.getByRole("tab", { name: "Daily" }).click();
  await page.getByRole("button", { name: "Edit tags for Focus" }).click();
  await expect(page.getByRole("checkbox", { name: "Work" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "Close tag picker" }).click();
  await page.getByRole("tab", { name: "Session" }).click();
  await page.getByRole("button", { name: "Start Session" }).click();
  await expect(
    page.getByRole("button", { name: "Edit tags for Focus" }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("bulk entry deduplicates and adds one atomic Session batch", async ({
  page,
}) => {
  await seedWorkspace(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add Activity" }).last().click();
  await page.getByRole("button", { name: "bulk" }).click();
  await page
    .getByRole("textbox", { name: "Bulk activity names" })
    .fill('cleaning, walking-dog, cleaning, "pre-work planning"');
  await expect(page.getByText("4 activities will be added.")).toBeVisible();
  await expect(page.getByText("1 duplicate ignored.")).toBeVisible();
  await page.getByRole("button", { name: "Add 4" }).click();

  for (const name of ["cleaning", "walking", "dog", "pre-work planning"]) {
    await expect(page.locator(`input[value="${name}"]`)).toHaveCount(1);
  }
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("Daily plus exposes bulk entry with the existing 60 minute default", async ({
  page,
}) => {
  await seedWorkspace(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Daily" }).click();
  await page.getByTitle("Add Activity").click();
  await page.getByRole("button", { name: "bulk" }).click();
  await page
    .getByRole("textbox", { name: "Bulk activity names" })
    .fill("cleaning-walking");
  await page.getByRole("button", { name: "Add 2" }).click();
  await expect(
    page.getByText("cleaning", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("walking", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("1h 0m", { exact: true })).toHaveCount(3);
});

test("malformed legacy tags do not blank advanced tag management", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await seedWorkspace(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Manage Activities" }).click();
  await page
    .getByRole("button", {
      name: "Timer lists, templates, tags & advanced setup",
    })
    .click();
  await page.getByRole("button", { name: "Manage Tags" }).click();
  await expect(page.getByText("Existing Tags")).toBeVisible();
  await expect(page.getByText("home", { exact: true }).first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});
