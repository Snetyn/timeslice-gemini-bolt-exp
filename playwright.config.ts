import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
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
  webServer: {
    command: "npm.cmd run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
