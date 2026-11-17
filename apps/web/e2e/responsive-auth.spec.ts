import { expect, test } from "@playwright/test"
import { testUser } from "./helpers"
import { detect, SIZES } from "./overflow"

test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "sizes are set inside the test") })

const LONG_MAIL = "a-really-long-work-address-for-testing-the-layout@very-long-company-domain-name.example.com"
const LONG_NAME = "Maximilian Alexander Montgomery-Featherstonehaugh the Third"
const SIGN_IN_AT = [280, 390, 768, 1920] // real sign-ins: few, so the auth provider's rate limit is not tripped

for (const w of SIZES) {
  test(`login, signup and auth screens fit ${w}px`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: w, height: w < 700 ? 800 : 900 })
    const bad: string[] = []
    const check = async (label: string) => { await page.waitForTimeout(250); for (const o of await page.evaluate(detect)) bad.push(`${label}: ${o}`) }
    const step = async (label: string, fn: () => Promise<void>) => { try { await fn() } catch (e) { bad.push(`${label}: could not be checked (${String(e).slice(0, 110)})`) } }
    const submit = (name: string) => page.getByRole("button", { name, exact: true }).click()

    await step("login", async () => {
      await page.goto("/login"); await expect(page.locator("h1").first()).toBeVisible(); await check("/login")
      await submit("Sign in"); await expect(page.getByRole("alert")).toBeVisible(); await check("/login empty error")
      await page.getByLabel("Work email").fill(LONG_MAIL)
      await page.getByLabel("Password", { exact: true }).fill("x".repeat(60))
      const reveal = page.getByRole("button", { name: /show password|hide password/i })
      if (await reveal.count()) { await reveal.first().click(); await check("/login password shown") }
      await check("/login long values")
    })

    await step("signup", async () => {
      await page.goto("/signup"); await expect(page.locator("h1").first()).toBeVisible(); await check("/signup")
      await submit("Create account"); await expect(page.getByRole("alert")).toBeVisible(); await check("/signup name error")
      await page.getByLabel("Full name").fill(LONG_NAME)
      await page.getByLabel("Work email").fill(LONG_MAIL)
      await page.getByLabel("Password", { exact: true }).fill("abc")
      await submit("Create account"); await expect(page.getByRole("alert")).toBeVisible(); await check("/signup weak password")
      await page.getByLabel("Password", { exact: true }).fill("Str0ng!Passw0rd-that-is-also-very-long-indeed")
      await check("/signup strong password")
      await submit("Create account"); await expect(page.getByRole("alert")).toContainText(/terms/i); await check("/signup terms error")
    })

    await step("forgot", async () => {
      await page.goto("/forgot-password"); await expect(page.locator("h1").first()).toBeVisible(); await check("/forgot-password")
      await submit("Send reset link"); await expect(page.getByRole("alert")).toBeVisible(); await check("/forgot-password error")
      await page.getByLabel("Work email").fill(LONG_MAIL); await check("/forgot-password long email")
    })

    await step("reset", async () => { await page.goto("/reset-password"); await expect(page.locator("h1").first()).toBeVisible(); await check("/reset-password") })

    await step("invite", async () => { await page.goto("/invite/not-a-real-token"); await expect(page.locator("h1").first()).toBeVisible(); await page.waitForLoadState("networkidle").catch(() => undefined); await check("/invite invalid") })

    await step("verify-email", async () => {
      await page.goto("/login")
      await page.evaluate((addr) => { history.pushState({ usr: { email: addr }, key: "t", idx: 1 }, "", "/verify-email"); window.dispatchEvent(new PopStateEvent("popstate", { state: history.state })) }, LONG_MAIL)
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible(); await check("/verify-email long address")
    })

    if (testUser && SIGN_IN_AT.includes(w)) await step("real sign-in", async () => {
      await page.goto("/login")
      await page.getByLabel("Work email").fill("nobody@example.com")
      await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-password")
      await submit("Sign in"); await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 }); await check("/login wrong password")
      await page.getByLabel("Work email").fill(testUser.email)
      await page.getByLabel("Password", { exact: true }).fill(testUser.password)
      await page.getByLabel("Password", { exact: true }).press("Enter")
      await page.waitForURL(/\/app/, { timeout: 30_000 })
      await expect(page.locator("main h1").first()).toBeVisible({ timeout: 30_000 })
      await check("/app after sign-in")
    })
    expect([...new Set(bad)]).toEqual([])
  })
}
