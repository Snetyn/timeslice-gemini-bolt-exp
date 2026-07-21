import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = (
  globalThis as unknown as {
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
      name: "mobile",
      use: { browserName: "chromium", ...devices["iPhone 13"] },
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
