import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = { tones: 0, buzzes: 0, speeches: [] as string[] };
    Object.defineProperty(window, "__alertTestState", { value: state });
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: () => {
        state.buzzes += 1;
        return true;
      },
    });
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = async () => undefined;
      createOscillator() {
        return {
          frequency: { value: 0 },
          type: "sine",
          connect: (target: unknown) => target,
          start: () => {
            state.tones += 1;
          },
          stop: () => undefined,
        };
      }
      createGain() {
        const gainNode = {
          gain: {
            setValueAtTime: () => undefined,
            exponentialRampToValueAtTime: () => undefined,
          },
          connect: () => gainNode,
        };
        return gainNode;
      }
    }
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    class FakeUtterance {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      voice = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: FakeUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        speak: (utterance: { text: string }) =>
          state.speeches.push(utterance.text),
        cancel: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
});

test("alert preferences, custom MM:SS values, and explicit tests persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const alerts = page.locator('[aria-label="Alerts and voice settings"]');
  await expect(alerts).toBeVisible();

  await alerts.getByLabel("Enable alerts").check();
  await alerts
    .getByRole("checkbox", { name: "Visual banner", exact: true })
    .check();
  await alerts.getByRole("checkbox", { name: "Sound", exact: true }).check();
  await alerts
    .getByRole("checkbox", { name: "Vibration", exact: true })
    .check();
  await alerts
    .getByRole("checkbox", { name: "Spoken timer", exact: true })
    .check();
  await alerts.getByLabel("Enable spoken timer profile").check();
  await alerts
    .getByRole("checkbox", { name: "Activity complete", exact: true })
    .check();
  await alerts
    .getByRole("checkbox", {
      name: "Remaining-time checkpoint",
      exact: true,
    })
    .check();
  await alerts.getByLabel("New remaining-time checkpoint").fill("2:30");
  await alerts.getByRole("button", { name: "Add", exact: true }).click();
  await alerts.getByRole("button", { name: "Test sound" }).click();
  await alerts.getByRole("button", { name: "Test buzz" }).click();
  await alerts.getByRole("button", { name: "Test voice" }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __alertTestState: {
                tones: number;
                buzzes: number;
                speeches: string[];
              };
            }
          ).__alertTestState,
      ),
    )
    .toMatchObject({
      tones: 1,
      buzzes: 1,
      speeches: ["TimeSlice, voice preview"],
    });
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByRole("button", { name: "Remove 2:30 checkpoint" }),
  ).toBeVisible();
  await expect(page.getByLabel("Enable alerts")).toBeChecked();
});

test("compact Settings and Android More sheet do not overflow", async ({
  page,
}) => {
  await page.goto("/");
  const more = page.getByRole("button", { name: "More actions" });
  if (await more.isVisible()) {
    await more.click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet.getByRole("button", { name: "History" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Insights" })).toBeVisible();
    await expect(
      sheet.getByRole("button", { name: "Choose next" }),
    ).toBeVisible();
    await sheet.getByRole("button", { name: "Close more actions" }).click();
  }
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("#settings-search")).toBeVisible();
  await page.locator("#settings-search").fill("speech");
  await expect(page.locator("#settings-section")).toHaveValue("alerts");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
