import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

// The API process is only started when a developer .env exists (real Supabase checks); CI runs the public smoke tests without it.
const api = existsSync("../../services/api/.env")

/** End-to-end tests run against the production build served locally. */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  // Real-organization tests change shared data, so they run one at a time when the API is configured.
  fullyParallel: !api,
  workers: api ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: [
    { command: "npm run build && npx vite preview --port 4173 --strictPort", url: "http://localhost:4173", reuseExistingServer: !process.env.CI, timeout: 180_000 },
    ...(api ? [{ command: "uv run uvicorn app.main:app --port 8000", cwd: "../../services/api", url: "http://localhost:8000/api/v1/health", reuseExistingServer: true, timeout: 60_000 }] : []),
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
})
