import { defineConfig, devices } from "@playwright/test";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5100";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1, // Single worker to avoid DB conflicts
  retries: 0,
  timeout: 60_000,

  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  // Starts the isolated test servers (ports from .test.env) unless they're already running.
  // Run `npm run test:setup` first to bring up the test MySQL/Redis/MinIO stack.
  webServer: [
    {
      command: "npm run test:back",
      url: `${API_URL}/api/auth/profile`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run test:front",
      url: APP_URL,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],

  projects: [
    {
      name: "chromium",
      testIgnore: /visual\//,
      use: { ...devices["Desktop Chrome"] },
    },
    // Screenshot sweep for manual review: `VISUAL=1 npx playwright test --project=visual`
    ...(process.env.VISUAL
      ? [{ name: "visual", testMatch: /visual\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"] } }]
      : []),
  ],
});
