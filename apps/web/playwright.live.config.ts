import { defineConfig, devices } from "@playwright/test"

/** Runs the end-to-end tests against the deployed site instead of a local build. Usage: npx playwright test -c playwright.live.config.ts */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.LIVE_URL ?? "https://venn-web-beta.vercel.app", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
})
