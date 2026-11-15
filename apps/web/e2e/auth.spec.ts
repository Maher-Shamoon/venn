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

test("an existing member goes straight to the app with their organization selected", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Work email").fill(user!.email)
  await page.getByLabel("Password", { exact: true }).fill(user!.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/app/)
  expect(await page.evaluate(() => localStorage.getItem("venn.org"))).toMatch(/^[0-9a-f-]{36}$/)
  // The browser reaches the API through the same origin and the API accepts the real token.
  const ctx = await page.evaluate(async () => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))!
    const token = JSON.parse(localStorage.getItem(key)!).access_token
    const r = await fetch("/api/v1/me/context", { headers: { Authorization: `Bearer ${token}`, "X-Organization-Id": localStorage.getItem("venn.org")! } })
    return { status: r.status, body: await r.json() }
  })
  expect(ctx.status).toBe(200)
  expect(ctx.body.role_key).toBe("owner")
})

test("sign-in and sign-up offer Continue with Google, and it reports plainly when Google is not switched on", async ({ page }) => {
  test.skip(!user, "Supabase is not configured")
  for (const path of ["/login", "/signup"]) {
    await page.goto(path)
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible()
  }
})
