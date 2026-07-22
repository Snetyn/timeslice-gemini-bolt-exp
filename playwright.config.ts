import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: externalBaseUrl || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", ...devices["Desktop Chrome"] },
    },
    {
      name: "android-360",
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
      },
    },
    {
      name: "android-412",
      use: {
        browserName: "chromium",
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm.cmd run preview",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
