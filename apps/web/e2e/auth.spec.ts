import { existsSync, readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

// Real Supabase sign-in. Needs .env.local (project URL and anon key) and the user from services/api/scripts/create_test_user.py.
const file = "e2e/.test-user.local"
const user = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string }) : null
test.skip(!user || !existsSync(".env.local"), "Supabase test user is not configured")

test("wrong password shows one generic message", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Work email").fill(user!.email)
  await page.getByLabel("Password", { exact: true }).fill("Not-The-Password-1!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert")).toHaveText("The email or password is incorrect.")
})

test("signs in with a real account, lands in the app, and signs out", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Work email").fill(user!.email)
  await page.getByLabel("Password", { exact: true }).fill(user!.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/(onboarding|app)/)
  expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("sb-")))).toBe(true)
  await page.goto("/app")
  await expect(page.getByRole("heading").first()).toBeVisible()
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("button", { name: /sign out/i }).click()
  await page.waitForURL(/\/login/)
  await page.goto("/app")
  await page.waitForURL(/\/login/)
})
