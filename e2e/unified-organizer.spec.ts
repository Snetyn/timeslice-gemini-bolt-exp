import { expect, test, type Page } from "@playwright/test";

const openOrganizer = async (page: Page) => {
  await page
    .getByRole("button", { name: "Manage Activities and Tasks" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tasks & Activities" }),
  ).toBeVisible();
};

const saveNamedEditor = async (page: Page, title: string, name: string) => {
  const editor = page.getByRole("dialog", { name: title });
  await editor.getByLabel("Name").fill(name);
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toHaveCount(0);
};

test("creates Folder → List → Task and preserves it across reload", async ({
  page,
}) => {
  await page.goto("/");
  await openOrganizer(page);

  await page.getByRole("button", { name: "+ Folder" }).click();
  await saveNamedEditor(page, "Add folder", "Home projects");
  await expect(
    page.getByRole("button", { name: "Home projects", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "+ List" }).click();
  const listEditor = page.getByRole("dialog", { name: "Add list" });
  await listEditor.getByLabel("Name").fill("Chores");
  await listEditor
    .getByLabel("Parent folder")
    .selectOption({ label: "Home projects" });
  await listEditor.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "+ Task" }).click();
  const taskEditor = page.getByRole("dialog", { name: "Add task" });
  await taskEditor.getByLabel("Name").fill("Clean kitchen");
  await taskEditor.getByLabel("List").selectOption({ label: "Chores" });
  await taskEditor.getByLabel("Estimate (minutes)").fill("25");
  await taskEditor.getByRole("button", { name: "Save" }).click();
  await expect(taskEditor).toHaveCount(0);
  await expect(page.getByText("Clean kitchen", { exact: true })).toBeVisible();

  await page.reload();
  await openOrganizer(page);
  await expect(page.getByText("Clean kitchen", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Clean kitchen 25m .* Chores/ }),
  ).toBeVisible();
  await expect(page.getByText("Activity Management")).toHaveCount(0);
});

test("supports multi-tag Any and All filters with stable tag editing", async ({
  page,
}) => {
  await page.goto("/");
  await openOrganizer(page);
  for (const name of ["Focus tag", "Home tag"]) {
    await page.getByRole("button", { name: "+ Tag" }).click();
    await saveNamedEditor(page, "Add tag", name);
  }

  await page.getByRole("button", { name: "+ Task" }).click();
  let editor = page.getByRole("dialog", { name: "Add task" });
  await editor.getByLabel("Name").fill("Tagged once");
  await editor.getByRole("button", { name: "#Focus tag" }).click();
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toHaveCount(0);

  await page.getByRole("button", { name: "+ Task" }).click();
  editor = page.getByRole("dialog", { name: "Add task" });
  await editor.getByLabel("Name").fill("Tagged twice");
  await editor.getByRole("button", { name: "#Focus tag" }).click();
  await editor.getByRole("button", { name: "#Home tag" }).click();
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toHaveCount(0);

  const tagRegion = page.getByRole("region", { name: "Tags", exact: true });
  await tagRegion.getByRole("button", { name: "#Focus tag" }).click();
  await tagRegion.getByRole("button", { name: "#Home tag" }).click();
  await page.getByRole("button", { name: "Any", exact: true }).click();
  await expect(page.getByText("Tagged once", { exact: true })).toBeVisible();
  await expect(page.getByText("Tagged twice", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByText("Tagged once", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Tagged twice", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit tag Focus tag" }).click();
  const tagEditor = page.getByRole("dialog", { name: "Edit tag" });
  await tagEditor.getByLabel("Name").fill("Deep Focus");
  await tagEditor.getByRole("button", { name: "Save" }).click();
  await expect(
    tagRegion.getByRole("button", { name: "#Deep Focus" }),
  ).toBeVisible();
  await expect(page.getByText("Tagged twice", { exact: true })).toBeVisible();
});

test("Back closes editor, then dashboard, with Android-safe geometry", async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  await page.goto("/");
  await openOrganizer(page);
  await page.getByRole("button", { name: "+ Task" }).click();
  await expect(page.getByRole("dialog", { name: "Add task" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Add task" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Tasks & Activities" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Tasks & Activities" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Session Duration" }),
  ).toBeVisible();

  await openOrganizer(page);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  for (const label of ["Back to Timer", "+ Add", "+ Folder", "+ List"]) {
    const box = await page.getByRole("button", { name: label }).boundingBox();
    expect(box?.height || 0).toBeGreaterThanOrEqual(44);
  }
  expect(errors).toEqual([]);
});
